import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { createRequestId, logInfo, logWarn } from "@/lib/observability/logger";

function validateJobSecret(incoming: string): boolean {
  const expected = process.env.JOB_RUNNER_SECRET ?? "";
  if (!incoming || !expected || incoming.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const requestId = createRequestId("job-debug");
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!validateJobSecret(token)) {
    logWarn("jobs.debug.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [jobSummaryResult, recentFailuresResult, missingSummaryResult] = await Promise.all([
    pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count
       FROM email_processing_jobs
       GROUP BY status
       ORDER BY status`,
    ),
    pool.query<{
      id: string;
      email_record_id: string;
      attempt_count: number;
      next_attempt_at: string | null;
      last_error: string | null;
      updated_at: string;
    }>(
      `SELECT id, email_record_id, attempt_count, next_attempt_at, last_error, updated_at
       FROM email_processing_jobs
       WHERE status = 'failed'
       ORDER BY updated_at DESC
       LIMIT 20`,
    ),
    pool.query<{
      id: string;
      message_domain: string | null;
      processing_status: string;
      summary: string | null;
      updated_at: string;
    }>(
      `SELECT id, message_domain, processing_status, summary, updated_at
       FROM email_records
       WHERE processing_status = 'completed'
         AND (summary IS NULL OR btrim(summary) = '')
       ORDER BY updated_at DESC
       LIMIT 20`,
    ),
  ]);

  logInfo("jobs.debug.snapshot", {
    requestId,
    statusBuckets: jobSummaryResult.rows,
    failedCount: recentFailuresResult.rows.length,
    missingSummaryCount: missingSummaryResult.rows.length,
  });

  return NextResponse.json({
    requestId,
    jobsByStatus: jobSummaryResult.rows,
    recentFailedJobs: recentFailuresResult.rows,
    recentCompletedWithoutSummary: missingSummaryResult.rows,
  });
}
