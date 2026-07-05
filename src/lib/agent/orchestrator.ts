import { extractEmailIntent } from "./extract";
import { scoreOpportunityMatch } from "@/lib/opportunities/match";
import { withTransaction } from "@/lib/db/transaction";
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
import { isDealRelevant, getDealMatchedRule, saveValuableDeal, type DealPreferences } from "./deals";
import type {
  EmailCategory,
  ProcessedActionButton,
  RecommendedAction,
} from "@/types/email";
import type { JobEmailExtraction } from "@/lib/opportunities/schemas";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";

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

type InboxProjection = {
  category: EmailCategory;
  summary: string;
  todos: string[];
  actionButtons: ProcessedActionButton[];
  recommendedAction: RecommendedAction;
};

function formatEventType(value: string | null): string {
  if (!value) return "update";
  return value.replaceAll("_", " ");
}

function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(/https?:\/\/[^\s)\]]+/g) ?? [])).slice(0, 3);
}

function deriveCategoryFromText(text: string): EmailCategory {
  const value = text.toLowerCase();
  if (/unsubscribe|weekly update|digest|newsletter/.test(value)) return "newsletter";
  if (/discount|coupon|promo|offer|sale|limited time|free gift/.test(value)) return "promotion";
  if (/action required|verify|security alert|delivery status|payment due|failed|deadline|urgent/.test(value)) return "alert";
  if (/hi\s|hello|regards|thanks|let me know|can we|catch up/.test(value)) return "personal";
  return "other";
}

function deriveActionItemsFromText(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const candidates = lines.filter((line) =>
    /(please|action required|respond|reply|complete|verify|confirm|pay|submit|review|apply|schedule|update)/i.test(line),
  );

  return Array.from(new Set(candidates)).slice(0, 3);
}

function buildInboxProjection(
  extraction: JobEmailExtraction,
  sourceText: string,
): InboxProjection {
  if (extraction.domain === "deal" && extraction.deal) {
    const deal = extraction.deal;
    const offerText = deal.discountPercent
      ? `${deal.discountPercent}% ${deal.offerType}`
      : deal.offerValue ?? deal.offerType;
    const summary = `${deal.brand}: ${offerText} offer${deal.expiresAt ? ` (expires ${new Date(deal.expiresAt).toLocaleDateString()})` : ""}.`;
    const todos = [
      ...(deal.actionUrl ? [`Review offer details: ${deal.actionUrl}`] : []),
    ];
    const actionButtons: ProcessedActionButton[] = deal.actionUrl
      ? [{ label: "Open Offer", kind: "url", href: deal.actionUrl, tone: "accent" }]
      : [];
    return {
      category: "promotion",
      summary,
      todos,
      actionButtons,
      recommendedAction: "keep",
    };
  }

  if (extraction.domain === "job") {
    const eventText = formatEventType(extraction.eventType);
    const companyText = extraction.company ? ` from ${extraction.company}` : "";
    const roleText = extraction.role ? ` for ${extraction.role}` : "";
    const summary = `Job ${eventText}${companyText}${roleText}.`;
    const todos: string[] = [];
    if (extraction.deadlineAt) {
      todos.push(`Track deadline: ${new Date(extraction.deadlineAt).toLocaleString()}`);
    }
    if (extraction.evidence[0]) {
      todos.push(`Key evidence: ${extraction.evidence[0]}`);
    }

    for (const action of extraction.suggestedActions) {
      if (action.type === "prepare_reply") {
        todos.push("Review and send a reply.");
      } else if (action.type === "schedule_reminder") {
        todos.push("Set a reminder for this update.");
      } else if (action.type === "prepare_calendar_event") {
        todos.push("Review calendar event details.");
      }
    }

    const urlButtons: ProcessedActionButton[] = extractUrls(sourceText).map((href, index) => ({
      label: index === 0 ? "Open Link" : `Open Link ${index + 1}`,
      kind: "url",
      href,
      tone: "accent",
    }));

    const recommendedAction: RecommendedAction = extraction.eventType === "rejection_received"
      ? "archive"
      : extraction.eventType === "recruiter_contact" ||
          extraction.eventType === "information_requested" ||
          extraction.eventType === "interview_invited"
        ? "draft_reply"
        : "keep";

    return {
      category: "alert",
      summary,
      todos: Array.from(new Set(todos)).slice(0, 5),
      actionButtons: urlButtons,
      recommendedAction,
    };
  }

  const category = deriveCategoryFromText(sourceText);
  const textTodos = deriveActionItemsFromText(sourceText);
  const urlButtons: ProcessedActionButton[] = extractUrls(sourceText).map((href, index) => ({
    label: index === 0 ? "Open Link" : `Open Link ${index + 1}`,
    kind: "url",
    href,
    tone: "accent",
  }));

  const summary = extraction.evidence[0] ?? "Email received and processed.";
  const recommendedAction: RecommendedAction =
    category === "alert" ? "keep" : category === "personal" ? "draft_reply" : "archive";

  return {
    category,
    summary,
    todos: textTodos,
    actionButtons: urlButtons,
    recommendedAction,
  };
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function processStoredEmail(
  emailRecordId: string,
): Promise<ProcessResult> {
  logInfo("orchestrator.start", { emailRecordId });
  try {
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
    const extractionInput =
      emailRecord.rawBody?.trim() ||
      emailRecord.rawMime?.toString("utf8").slice(0, 12_000) ||
      "";
    const extraction = await extractEmailIntent(extractionInput, prefInput);
    const inboxProjection = buildInboxProjection(extraction, extractionInput);
    logInfo("orchestrator.extracted", {
      emailRecordId,
      userId: emailRecord.userId,
      domain: extraction.domain,
      eventType: extraction.eventType,
      modelConfidence: extraction.modelConfidence,
      summaryLength: inboxProjection.summary.length,
      todosCount: inboxProjection.todos.length,
      actionButtonsCount: inboxProjection.actionButtons.length,
      recommendedAction: inboxProjection.recommendedAction,
    });

    // Step 4: Short write transaction to persist everything
    const { confidence, opportunityId, eventId, actionIds } =
      await withTransaction(async (client) => {
        if (extraction.domain === "deal" && extraction.deal) {
          const deal = extraction.deal;
          const dealPrefs: DealPreferences = {
            minimumDiscountPercent: preferences?.deal_preferences?.minimumDiscountPercent ?? 30,
            freeGifts: preferences?.deal_preferences?.freeGifts ?? false,
            targetBrands: [],
          };

          if (isDealRelevant({ ...deal }, dealPrefs)) {
            const rule = getDealMatchedRule({ ...deal }, dealPrefs);
            await saveValuableDeal({
              userId: emailRecord.userId,
              emailRecordId,
              brand: deal.brand,
              offerType: deal.offerType,
              discountPercent: deal.discountPercent,
              freeGift: deal.freeGift,
              expiresAt: deal.expiresAt,
              offerValue: deal.offerValue,
              matchedRule: rule,
              relevanceReason: `${rule}: ${deal.evidence[0] ?? ""}`,
            });
          }

          await client.query(
            `UPDATE email_records
             SET processing_status = 'completed', message_domain = 'deal',
                 structured_extraction = $1, category = $2, summary = $3,
                 todos = $4, action_buttons = $5, recommended_action = $6
             WHERE id = $7`,
            [
              JSON.stringify(extraction),
              inboxProjection.category,
              inboxProjection.summary,
              JSON.stringify(inboxProjection.todos),
              JSON.stringify(inboxProjection.actionButtons),
              inboxProjection.recommendedAction,
              emailRecordId,
            ],
          );
          logInfo("orchestrator.persisted", {
            emailRecordId,
            domain: "deal",
            category: inboxProjection.category,
            summaryLength: inboxProjection.summary.length,
          });
          return {
            confidence: null as number | null,
            opportunityId: null as string | null,
            eventId: null as string | null,
            actionIds: [] as string[],
          };
        }

        if (extraction.domain !== "job" || !extraction.eventType) {
          // Mark as completed — not a job email
          await client.query(
            `UPDATE email_records
             SET processing_status = 'completed', message_domain = $1,
                 structured_extraction = $2, category = $3, summary = $4,
                 todos = $5, action_buttons = $6, recommended_action = $7
             WHERE id = $8`,
            [
              extraction.domain,
              JSON.stringify(extraction),
              inboxProjection.category,
              inboxProjection.summary,
              JSON.stringify(inboxProjection.todos),
              JSON.stringify(inboxProjection.actionButtons),
              inboxProjection.recommendedAction,
              emailRecordId,
            ],
          );
          logInfo("orchestrator.persisted", {
            emailRecordId,
            domain: extraction.domain,
            category: inboxProjection.category,
            summaryLength: inboxProjection.summary.length,
          });
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
          logWarn("orchestrator.invalid_suggested_action", {
            emailRecordId,
            actionType: action.type,
          });
        }
      }

      // Update email record
      await client.query(
        `UPDATE email_records
         SET processing_status = 'completed', message_domain = $1,
             structured_extraction = $2, category = $3, summary = $4,
             todos = $5, action_buttons = $6, recommended_action = $7
         WHERE id = $8`,
        [
          extraction.domain,
          JSON.stringify(extraction),
          inboxProjection.category,
          inboxProjection.summary,
          JSON.stringify(inboxProjection.todos),
          JSON.stringify(inboxProjection.actionButtons),
          inboxProjection.recommendedAction,
          emailRecordId,
        ],
      );
      logInfo("orchestrator.persisted", {
        emailRecordId,
        domain: extraction.domain,
        category: inboxProjection.category,
        summaryLength: inboxProjection.summary.length,
      });

      return { confidence, opportunityId, eventId, actionIds };
    });

    logInfo("orchestrator.completed", {
      emailRecordId,
      domain: extraction.domain,
      confidence,
      status: opportunityId ? "completed" : "human_review",
      actionsCount: actionIds.length,
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
  } catch (error) {
    logError("orchestrator.failed", error, { emailRecordId });
    throw error;
  }
}
