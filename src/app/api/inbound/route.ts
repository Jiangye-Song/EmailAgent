import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { parseMimeEmail } from "@/lib/email/parser";
import {
  getUserByForwardingAddress,
  isSenderWhitelisted,
} from "@/lib/email/forwarding-address";
import {
  enqueueInboundEmail,
  completeJobForEmailRecord,
  computeContentHash,
} from "@/lib/jobs/email-jobs";
import { processStoredEmail } from "@/lib/agent/orchestrator";
import { pool } from "@/lib/db";
import {
  createRequestId,
  logError,
  logInfo,
  logWarn,
} from "@/lib/observability/logger";

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
const JOB_TRIGGER_TIMEOUT_MS = 4000;

function buildPreviewSummary(body: string | null): string {
  if (!body) return "Email received, but AI summary generation failed.";
  const line = body
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.length > 0);
  if (!line) return "Email received, but AI summary generation failed.";
  return line.length > 220 ? `${line.slice(0, 217)}...` : line;
}

function validateSecret(incoming: string): boolean {
  const expected = process.env.CF_INBOUND_SECRET ?? "";
  if (!incoming || !expected || incoming.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function processInlineFallback(
  requestId: string,
  emailRecordId: string,
): Promise<void> {
  logWarn("inbound.inline_processing_start", { requestId, emailRecordId });
  try {
    await processStoredEmail(emailRecordId);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await completeJobForEmailRecord(client, emailRecordId);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    logInfo("inbound.inline_processing_ok", { requestId, emailRecordId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query<{ raw_body: string | null }>(
          `SELECT raw_body FROM email_records WHERE id = $1`,
          [emailRecordId],
        );
        const preview = buildPreviewSummary(rows[0]?.raw_body ?? null);

        await client.query(
          `UPDATE email_records
           SET summary = COALESCE(NULLIF(summary, ''), $1),
               category = COALESCE(category, 'other'),
               todos = COALESCE(todos, '[]'::jsonb),
               action_buttons = COALESCE(action_buttons, '[]'::jsonb),
               recommended_action = COALESCE(recommended_action, 'keep'),
               processing_status = 'failed',
               last_processing_error = $2
           WHERE id = $3`,
          [preview, errorMessage, emailRecordId],
        );

        await client.query(
          `UPDATE email_processing_jobs
           SET status = 'failed',
               last_error = $1,
               lease_owner = null,
               lease_expires_at = null,
               updated_at = now()
           WHERE email_record_id = $2
             AND status IN ('pending', 'processing')`,
          [errorMessage, emailRecordId],
        );

        await client.query("COMMIT");
      } catch (persistError) {
        await client.query("ROLLBACK").catch(() => {});
        throw persistError;
      } finally {
        client.release();
      }

      logWarn("inbound.inline_processing_fallback_saved", {
        requestId,
        emailRecordId,
      });
    } catch (persistError) {
      logError("inbound.inline_processing_fallback_failed", persistError, {
        requestId,
        emailRecordId,
      });
    }

    logError("inbound.inline_processing_failed", error, {
      requestId,
      emailRecordId,
    });
  }
}

async function triggerJobRunner(
  origin: string,
  requestId: string,
  emailRecordId: string,
): Promise<void> {
  const token = process.env.JOB_RUNNER_SECRET ?? "";
  if (!token) {
    logWarn("inbound.job_trigger_skipped_missing_secret", { requestId });
    await processInlineFallback(requestId, emailRecordId);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JOB_TRIGGER_TIMEOUT_MS);

  try {
    const response = await fetch(`${origin}/api/jobs/process-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      logWarn("inbound.job_trigger_non_ok", {
        requestId,
        status: response.status,
      });
      return;
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Some environments may return empty body; status code already confirmed.
    }

    logInfo("inbound.job_trigger_ok", {
      requestId,
      status: response.status,
      payload,
    });
  } catch (error) {
    logError("inbound.job_trigger_failed", error, { requestId });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId("inbound");
  const secret = req.headers.get("x-cf-secret") ?? "";
  if (!validateSecret(secret)) {
    logWarn("inbound.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipient = req.headers.get("x-recipient") ?? "";
  if (!recipient) {
    logWarn("inbound.missing_recipient", { requestId });
    return NextResponse.json({ error: "Missing X-Recipient" }, { status: 400 });
  }

  const user = await getUserByForwardingAddress(recipient);
  if (!user) {
    logInfo("inbound.unknown_recipient", { requestId, recipient });
    return NextResponse.json(
      { ok: true, skipped: "unknown_recipient" },
      { status: 202 },
    );
  }

  // Enforce body size limit
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    logWarn("inbound.payload_too_large_header", {
      requestId,
      contentLength,
      maxBytes: MAX_BODY_BYTES,
      userId: user.id,
    });
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawBuffer = Buffer.from(await req.arrayBuffer());
  if (rawBuffer.byteLength > MAX_BODY_BYTES) {
    logWarn("inbound.payload_too_large_body", {
      requestId,
      bodyBytes: rawBuffer.byteLength,
      maxBytes: MAX_BODY_BYTES,
      userId: user.id,
    });
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let email;
  try {
    email = await parseMimeEmail(rawBuffer);
  } catch (error) {
    logError("inbound.parse_failed", error, {
      requestId,
      userId: user.id,
      bodyBytes: rawBuffer.byteLength,
    });
    return NextResponse.json({ error: "Parse failed" }, { status: 422 });
  }

  // Sender whitelist: optional preference signal — log, do not reject
  const senderAllowed = await isSenderWhitelisted(user.id, email.from);
  if (!senderAllowed) {
    logInfo("inbound.sender_not_whitelisted", {
      requestId,
      userId: user.id,
      sender: email.from,
    });
  }

  // email.id is the Message-ID; email.date is an ISO 8601 string
  const messageId = email.id ?? `no-message-id-${Date.now()}`;
  const contentHash = computeContentHash(user.id, messageId, rawBuffer);

  logInfo("inbound.parsed", {
    requestId,
    userId: user.id,
    messageId,
    subject: email.subject ?? null,
    sender: email.from,
    bodyLength: email.body?.length ?? 0,
  });

  let emailRecordId = "";
  let isDuplicate = false;

  try {
    const enqueueResult = await enqueueInboundEmail({
      userId: user.id,
      messageId,
      subject: email.subject ?? null,
      sender: email.from,
      receivedAt: email.date ? new Date(email.date) : new Date(),
      contentHash,
      rawMime: rawBuffer,
      parsedBody: email.body ?? "",
    });
    emailRecordId = enqueueResult.emailRecordId;
    isDuplicate = enqueueResult.isDuplicate;
  } catch (error) {
    logError("inbound.enqueue_failed", error, {
      requestId,
      userId: user.id,
      messageId,
    });
    return NextResponse.json({ error: "Enqueue failed" }, { status: 500 });
  }

  logInfo("inbound.enqueued", {
    requestId,
    userId: user.id,
    messageId,
    emailRecordId,
    isDuplicate,
  });

  // Kick the queue processor right away so local/dev does not depend on cron timers.
  await triggerJobRunner(req.nextUrl.origin, requestId, emailRecordId);

  return NextResponse.json(
    { ok: true, accepted: true, requestId, emailRecordId, isDuplicate },
    { status: 202 },
  );
}
