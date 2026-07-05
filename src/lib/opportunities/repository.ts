import type { PoolClient } from "pg";
import { normalizeCompany, normalizeRole } from "./normalize";
import { projectOpportunity } from "./project";
import type { JobEventType } from "./schemas";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailRecord = {
  id: string;
  userId: string;
  processingStatus: string;
  contentHash: string | null;
  structuredExtraction: unknown;
  rawMime: Buffer | null;
  rawBody: string | null;
};

export type OpportunityCandidate = {
  id: string;
  normalizedCompany: string;
  normalizedRole: string;
  applicationReference: string | null;
};

export type CreateOpportunityInput = {
  userId: string;
  company: string;
  role: string;
  location: string | null;
  applicationReference: string | null;
  initialConfidence: number;
};

export type AppendEventInput = {
  opportunityId: string;
  emailRecordId: string | null;
  eventType: string;
  eventAt: string | null;
  deadlineAt: string | null;
  evidence: string[];
  confidence: number;
  confirmationStatus: "automatic" | "pending";
  extraction: unknown;
};

export type SaveActionInput = {
  userId: string;
  opportunityEventId: string | null;
  actionType: string;
  payload: unknown;
  status: "proposed" | "approved";
};

// ─── Queries — all accept a PoolClient, never open their own transaction ──────

export async function getEmailForProcessing(
  client: PoolClient,
  emailRecordId: string,
): Promise<EmailRecord | null> {
  const { rows } = await client.query<{
    id: string;
    user_id: string;
    processing_status: string;
    content_hash: string | null;
    structured_extraction: unknown;
    raw_mime: Buffer | null;
    raw_body: string | null;
  }>(
    `SELECT id, user_id, processing_status, content_hash, structured_extraction, raw_mime, raw_body
     FROM email_records WHERE id = $1`,
    [emailRecordId],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    userId: r.user_id,
    processingStatus: r.processing_status,
    contentHash: r.content_hash,
    structuredExtraction: r.structured_extraction,
    rawMime: r.raw_mime,
    rawBody: r.raw_body,
  };
}

export async function getPreferences(client: PoolClient, userId: string) {
  const { rows } = await client.query<{
    target_roles: string[];
    locations: string[];
    remote_preference: string;
    target_companies: string[];
    immediate_alert_events: string[];
    deal_preferences: { minimumDiscountPercent: number; freeGifts: boolean };
    freeform_instruction: string;
  }>(
    `SELECT target_roles, locations, remote_preference, target_companies,
            immediate_alert_events, deal_preferences, freeform_instruction
     FROM user_preferences WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function findOpportunityCandidates(
  client: PoolClient,
  userId: string,
): Promise<OpportunityCandidate[]> {
  const { rows } = await client.query<{
    id: string;
    normalized_company: string;
    normalized_role: string;
    application_reference: string | null;
  }>(
    `SELECT id, normalized_company, normalized_role, application_reference
     FROM opportunities
     WHERE user_id = $1 AND outcome = 'active'
     ORDER BY updated_at DESC
     LIMIT 50`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    normalizedCompany: r.normalized_company,
    normalizedRole: r.normalized_role,
    applicationReference: r.application_reference,
  }));
}

export async function createOpportunity(
  client: PoolClient,
  input: CreateOpportunityInput,
): Promise<string> {
  const normalized_company = normalizeCompany(input.company);
  const normalized_role = normalizeRole(input.role);
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO opportunities
       (user_id, company, normalized_company, role, normalized_role,
        location, application_reference, latest_confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.userId,
      input.company,
      normalized_company,
      input.role,
      normalized_role,
      input.location,
      input.applicationReference,
      input.initialConfidence,
    ],
  );
  return rows[0].id;
}

export async function appendOpportunityEvent(
  client: PoolClient,
  input: AppendEventInput,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO opportunity_events
       (opportunity_id, email_record_id, event_type, event_at, deadline_at,
        evidence, confidence, confirmation_status, extraction)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (opportunity_id, email_record_id, event_type)
       DO UPDATE SET confidence = EXCLUDED.confidence
     RETURNING id`,
    [
      input.opportunityId,
      input.emailRecordId,
      input.eventType,
      input.eventAt,
      input.deadlineAt,
      JSON.stringify(input.evidence),
      input.confidence,
      input.confirmationStatus,
      JSON.stringify(input.extraction),
    ],
  );
  return rows[0].id;
}

export async function saveAgentAction(
  client: PoolClient,
  input: SaveActionInput,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO agent_actions
       (user_id, opportunity_event_id, action_type, payload, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.userId,
      input.opportunityEventId,
      input.actionType,
      JSON.stringify(input.payload),
      input.status,
    ],
  );
  return rows[0].id;
}

export async function updateOpportunityProjection(
  client: PoolClient,
  opportunityId: string,
): Promise<void> {
  const { rows } = await client.query<{
    event_type: string;
    confirmation_status: string;
    deadline_at: string | null;
  }>(
    `SELECT event_type, confirmation_status, deadline_at
     FROM opportunity_events
     WHERE opportunity_id = $1
     ORDER BY created_at ASC`,
    [opportunityId],
  );

  const events = rows.map((r) => ({
    eventType: r.event_type as JobEventType,
    confirmed: r.confirmation_status === "automatic",
    deadlineAt: r.deadline_at,
  }));

  const projection = projectOpportunity(events);

  await client.query(
    `UPDATE opportunities
     SET current_stage = $1, outcome = $2, next_deadline = $3, updated_at = now()
     WHERE id = $4`,
    [projection.stage, projection.outcome, projection.nextDeadline, opportunityId],
  );
}
