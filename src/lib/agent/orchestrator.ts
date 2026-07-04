import { extractEmailIntent } from "./extract";
import { scoreOpportunityMatch } from "@/lib/opportunities/match";
import { withTransaction } from "@/lib/db/transaction";
import type { EmailRecord } from "@/lib/opportunities/repository";
import {
  getEmailForProcessing,
  getPreferences,
  findOpportunityCandidates,
  createOpportunity,
  appendOpportunityEvent,
  saveAgentAction,
  updateOpportunityProjection,
} from "@/lib/opportunities/repository";
import { validateToolCall, isRequiresApproval } from "./tools";

// ─── Confidence ───────────────────────────────────────────────────────────────

export type ConfidenceInput = {
  model: number;
  evidenceCount: number;
  exactReference: boolean;
  exactCompanyRole: boolean;
  hasEventType: boolean;
};

export function compositeConfidence(input: ConfidenceInput): number {
  const evidence = Math.min(input.evidenceCount / 2, 1);
  const identity = input.exactReference ? 1 : input.exactCompanyRole ? 0.9 : 0.5;
  const event = input.hasEventType ? 1 : 0;
  return Number(
    (
      input.model * 0.5 +
      evidence * 0.15 +
      identity * 0.25 +
      event * 0.1
    ).toFixed(3),
  );
}

// ─── Process result ───────────────────────────────────────────────────────────

export type ProcessResult = {
  emailRecordId: string;
  domain: string;
  confidence: number | null;
  opportunityId: string | null;
  eventId: string | null;
  actions: string[];
  status: "completed" | "human_review" | "other";
};

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function processStoredEmail(
  emailRecordId: string,
): Promise<ProcessResult> {
  // Step 1: Get email and preferences inside a short read-only transaction
  // Return the values so TypeScript can properly infer the types
  const { emailRecord, preferences } = await withTransaction(async (client) => {
    const record = await getEmailForProcessing(client, emailRecordId);
    if (!record) throw new Error(`Email record not found: ${emailRecordId}`);
    const prefs = await getPreferences(client, record.userId);
    return { emailRecord: record, preferences: prefs };
  });

  // Step 2: Build preferences for extraction (use defaults if none saved)
  const prefInput = preferences
    ? {
        targetRoles: preferences.target_roles ?? [],
        locations: preferences.locations ?? [],
        remotePreference: (preferences.remote_preference ?? "either") as
          | "remote"
          | "hybrid"
          | "onsite"
          | "either",
        targetCompanies: preferences.target_companies ?? [],
        immediateAlertEvents: (preferences.immediate_alert_events ?? []) as never,
        minimumDiscountPercent: preferences.deal_preferences?.minimumDiscountPercent ?? 30,
        freeGifts: preferences.deal_preferences?.freeGifts ?? false,
        freeformInstruction: preferences.freeform_instruction ?? "",
      }
    : {
        targetRoles: ["Software Engineer"],
        locations: [],
        remotePreference: "either" as const,
        targetCompanies: [],
        immediateAlertEvents: [] as never,
        minimumDiscountPercent: 30,
        freeGifts: false,
        freeformInstruction: "",
      };

  // Step 3: Extract with Qwen (outside the transaction — can be slow)
  const rawEmail = emailRecord.rawMime?.toString("utf8") ?? "";
  const extraction = await extractEmailIntent(rawEmail, prefInput);

  // Step 4: Short write transaction to persist everything
  const { confidence, opportunityId, eventId, actionIds } =
    await withTransaction(async (client) => {
      if (extraction.domain !== "job" || !extraction.eventType) {
        // Mark as completed — not a job email
        await client.query(
          `UPDATE email_records
           SET processing_status = 'completed', message_domain = $1,
               structured_extraction = $2, updated_at = now()
           WHERE id = $3`,
          [extraction.domain, JSON.stringify(extraction), emailRecordId],
        );
        return {
          confidence: null as number | null,
          opportunityId: null as string | null,
          eventId: null as string | null,
          actionIds: [] as string[],
        };
      }

      // Calculate composite confidence
      const candidates = await findOpportunityCandidates(client, emailRecord.userId);

      // Score candidates
      const scored = candidates
        .map((c) => ({
          ...c,
          ...scoreOpportunityMatch(
            {
              company: extraction.company,
              role: extraction.role,
              applicationReference: extraction.applicationReference,
            },
            c,
          ),
        }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);

      const bestMatch = scored[0];
      const hasAmbiguity =
        scored.length >= 2 &&
        scored[1].score >= 0.7 &&
        bestMatch.score - scored[1].score < 0.2;

      const exactReference =
        !!extraction.applicationReference &&
        bestMatch?.applicationReference === extraction.applicationReference;
      const exactCompanyRole = bestMatch?.score === 0.9;

      const confidence = compositeConfidence({
        model: extraction.modelConfidence,
        evidenceCount: extraction.evidence.length,
        exactReference,
        exactCompanyRole,
        hasEventType: !!extraction.eventType,
      });

      let opportunityId: string | null = null;
      let eventId: string | null = null;
      const actionIds: string[] = [];
      let confirmationStatus: "automatic" | "pending" = "pending";

      if (confidence >= 0.85 && !hasAmbiguity) {
        // HIGH confidence: auto-apply
        confirmationStatus = "automatic";
        if (bestMatch && bestMatch.score >= 0.85) {
          opportunityId = bestMatch.id;
        } else {
          // Create new opportunity
          opportunityId = await createOpportunity(client, {
            userId: emailRecord.userId,
            company: extraction.company ?? "Unknown",
            role: extraction.role ?? "Unknown",
            location: extraction.location,
            applicationReference: extraction.applicationReference,
            initialConfidence: confidence,
          });
        }
      } else if (confidence >= 0.60 && !hasAmbiguity) {
        // MEDIUM confidence: create opportunity but mark events as pending
        confirmationStatus = "pending";
        if (bestMatch && bestMatch.score >= 0.85) {
          opportunityId = bestMatch.id;
        } else {
          // Create new opportunity
          opportunityId = await createOpportunity(client, {
            userId: emailRecord.userId,
            company: extraction.company ?? "Unknown",
            role: extraction.role ?? "Unknown",
            location: extraction.location,
            applicationReference: extraction.applicationReference,
            initialConfidence: confidence,
          });
        }
      } else {
        // LOW confidence or ambiguous: request human review only
        await saveAgentAction(client, {
          userId: emailRecord.userId,
          opportunityEventId: null,
          actionType: "request_human_review",
          payload: {
            reason: hasAmbiguity ? "ambiguous_match" : "low_confidence",
            confidence,
            extraction,
          },
          status: "proposed",
        });
        // DO NOT create/update opportunity
      }

      // Append event if we have an opportunity
      if (opportunityId && extraction.eventType) {
        eventId = await appendOpportunityEvent(client, {
          opportunityId,
          emailRecordId,
          eventType: extraction.eventType,
          eventAt: extraction.eventAt,
          deadlineAt: extraction.deadlineAt,
          evidence: extraction.evidence,
          confidence,
          confirmationStatus,
          extraction,
        });

        // For medium confidence, save a propose_stage_update action for user to confirm
        if (confirmationStatus === "pending") {
          const stageActionId = await saveAgentAction(client, {
            userId: emailRecord.userId,
            opportunityEventId: eventId,
            actionType: "propose_stage_update",
            payload: {
              opportunityId,
              eventType: extraction.eventType,
              confidence,
              extraction,
            },
            status: "proposed",
          });
          actionIds.push(stageActionId);
        }

        await updateOpportunityProjection(client, opportunityId);
      }

      // Process suggested actions
      for (const action of extraction.suggestedActions) {
        try {
          validateToolCall(action);
          const requiresApproval = isRequiresApproval(action.type);
          const actionId = await saveAgentAction(client, {
            userId: emailRecord.userId,
            opportunityEventId: eventId,
            actionType: action.type,
            payload: action.payload,
            status: requiresApproval ? "proposed" : "approved",
          });
          actionIds.push(actionId);
        } catch {
          // Invalid tool — silently skip (do not record)
        }
      }

      // Update email record
      await client.query(
        `UPDATE email_records
         SET processing_status = 'completed', message_domain = $1,
             structured_extraction = $2, updated_at = now()
         WHERE id = $3`,
        [extraction.domain, JSON.stringify(extraction), emailRecordId],
      );

      return { confidence, opportunityId, eventId, actionIds };
    });

  return {
    emailRecordId,
    domain: extraction.domain,
    confidence,
    opportunityId,
    eventId,
    actions: actionIds,
    status: opportunityId ? "completed" : "human_review",
  };
}
