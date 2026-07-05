import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { claimJobs, completeJob, failJob } from "@/lib/jobs/email-jobs";
import { processStoredEmail } from "@/lib/agent/orchestrator";
import {
  createRequestId,
  logError,
  logInfo,
  logWarn,
} from "@/lib/observability/logger";

function validateJobSecret(incoming: string): boolean {
  const expected = process.env.JOB_RUNNER_SECRET ?? "";
  if (!incoming || !expected || incoming.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId("job-run");
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!validateJobSecret(token)) {
    logWarn("jobs.process_email.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logInfo("jobs.process_email.start", { requestId });

  const client = await pool.connect();
  let jobs: Awaited<ReturnType<typeof claimJobs>> = [];
  try {
    await client.query("BEGIN");
    jobs = await claimJobs(client, "job-runner", 3);
    await client.query("COMMIT");
    logInfo("jobs.process_email.claimed", {
      requestId,
      claimedCount: jobs.length,
      jobIds: jobs.map((job) => job.jobId),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    logError("jobs.process_email.claim_failed", err, { requestId });
    throw err;
  }
  client.release();

  if (jobs.length === 0) {
    logInfo("jobs.process_email.noop", { requestId });
  }

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      logInfo("jobs.process_email.job_started", {
        requestId,
        jobId: job.jobId,
        emailRecordId: job.emailRecordId,
        attemptCount: job.attemptCount,
      });
      try {
        const processResult = await processStoredEmail(job.emailRecordId);
        const c2 = await pool.connect();
        try {
          await c2.query("BEGIN");
          await completeJob(c2, job.jobId);
          await c2.query("COMMIT");
          logInfo("jobs.process_email.job_completed", {
            requestId,
            jobId: job.jobId,
            emailRecordId: job.emailRecordId,
            domain: processResult.domain,
            confidence: processResult.confidence,
            resultStatus: processResult.status,
          });
        } catch {
          await c2.query("ROLLBACK").catch(() => {});
          throw new Error("Failed to mark job complete");
        } finally {
          c2.release();
        }
        return { jobId: job.jobId, status: "completed" };
      } catch (err) {
        logError("jobs.process_email.job_failed", err, {
          requestId,
          jobId: job.jobId,
          emailRecordId: job.emailRecordId,
          attemptCount: job.attemptCount,
        });
        const c3 = await pool.connect();
        try {
          await c3.query("BEGIN");
          await failJob(
            c3,
            job.jobId,
            err instanceof Error ? err.message : String(err),
            job.attemptCount,
          );
          await c3.query("COMMIT");
          logWarn("jobs.process_email.job_marked_failed", {
            requestId,
            jobId: job.jobId,
            emailRecordId: job.emailRecordId,
            attemptCount: job.attemptCount,
          });
        } catch {
          await c3.query("ROLLBACK").catch(() => {});
        } finally {
          c3.release();
        }
        return { jobId: job.jobId, status: "failed", error: String(err) };
      }
    }),
  );

  logInfo("jobs.process_email.finish", {
    requestId,
    processed: results.length,
    fulfilled: results.filter((r) => r.status === "fulfilled").length,
    rejected: results.filter((r) => r.status === "rejected").length,
  });

  return NextResponse.json({
    requestId,
    processed: results.length,
    results: results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: r.reason },
    ),
  });
}
