import { createHash, randomBytes } from "node:crypto";
import { withTransaction } from "@/lib/db/transaction";
import type { PoolClient } from "pg";

export const LEASE_DURATION_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 4;
export const RETRY_DELAYS_MS = [
  1 * 60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
] as const;

export type EnqueueInput = {
  userId: string;
  messageId: string;
  subject: string | null;
  sender: string;
  receivedAt: Date;
  contentHash: string;
  rawMime: Buffer;
  parsedBody: string;
};

export type EnqueueResult = {
  emailRecordId: string;
  isDuplicate: boolean;
};

export async function enqueueInboundEmail(
  input: EnqueueInput,
): Promise<EnqueueResult> {
  return withTransaction(async (client) => {
    // Check for duplicate
    const dup = await client.query<{ id: string }>(
      `SELECT id FROM email_records
       WHERE user_id = $1 AND content_hash = $2`,
      [input.userId, input.contentHash],
    );
    if (dup.rows[0]) {
      return { emailRecordId: dup.rows[0].id, isDuplicate: true };
    }

    // Insert email record
    const emailRow = await client.query<{ id: string }>(
      `INSERT INTO email_records
         (user_id, message_id, subject, sender, received_at,
          content_hash, raw_mime, raw_body, processing_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'received')
       RETURNING id`,
      [
        input.userId,
        input.messageId,
        input.subject,
        input.sender,
        input.receivedAt,
        input.contentHash,
        input.rawMime,
        input.parsedBody,
      ],
    );

    const emailRecordId = emailRow.rows[0].id;

    // Insert processing job
    await client.query(
      `INSERT INTO email_processing_jobs
         (email_record_id, user_id, status, next_attempt_at)
       VALUES ($1, $2, 'pending', now())`,
      [emailRecordId, input.userId],
    );

    return { emailRecordId, isDuplicate: false };
  });
}

export type ClaimedJob = {
  jobId: string;
  emailRecordId: string;
  userId: string;
  attemptCount: number;
};

export async function claimJobs(
  client: PoolClient,
  workerName: string,
  limit: number,
): Promise<ClaimedJob[]> {
  const leaseExpiry = new Date(Date.now() + LEASE_DURATION_MS);

  const { rows } = await client.query<{
    id: string;
    email_record_id: string;
    user_id: string;
    attempt_count: number;
  }>(
    `UPDATE email_processing_jobs
     SET status = 'processing',
         lease_owner = $1,
         lease_expires_at = $2,
         attempt_count = attempt_count + 1,
         updated_at = now()
     WHERE id IN (
       SELECT id FROM email_processing_jobs
       WHERE status = 'pending'
         AND next_attempt_at <= now()
         AND attempt_count < $3
       ORDER BY next_attempt_at ASC
       LIMIT $4
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, email_record_id, user_id, attempt_count`,
    [workerName, leaseExpiry, MAX_ATTEMPTS, limit],
  );

  return rows.map((r) => ({
    jobId: r.id,
    emailRecordId: r.email_record_id,
    userId: r.user_id,
    attemptCount: r.attempt_count,
  }));
}

export async function completeJob(
  client: PoolClient,
  jobId: string,
): Promise<void> {
  await client.query(
    `UPDATE email_processing_jobs
     SET status = 'completed', lease_owner = null, lease_expires_at = null,
         updated_at = now()
     WHERE id = $1`,
    [jobId],
  );
}

export async function failJob(
  client: PoolClient,
  jobId: string,
  error: string,
  attemptCount: number,
): Promise<void> {
  const retryIndex = Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1);
  const nextAttemptDelay =
    RETRY_DELAYS_MS[retryIndex] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const isFinal = attemptCount >= MAX_ATTEMPTS;

  await client.query(
    `UPDATE email_processing_jobs
     SET status = $1,
         last_error = $2,
         next_attempt_at = $3,
         lease_owner = null,
         lease_expires_at = null,
         updated_at = now()
     WHERE id = $4`,
    [
      isFinal ? "failed" : "pending",
      error,
      isFinal ? null : new Date(Date.now() + nextAttemptDelay),
      jobId,
    ],
  );
}

export function computeContentHash(
  userId: string,
  messageId: string,
  rawBody: Buffer,
): string {
  return createHash("sha256")
    .update(userId)
    .update(messageId)
    .update(rawBody)
    .digest("hex");
}

export function generateForwardingAlias(domain: string): string {
  const prefix = randomBytes(12).toString("hex");
  return `${prefix}@${domain}`;
}
