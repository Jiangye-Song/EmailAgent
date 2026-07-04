import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { claimJobs, completeJob, failJob } from "@/lib/jobs/email-jobs";
import { processStoredEmail } from "@/lib/agent/orchestrator";

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
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!validateJobSecret(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();
  let jobs: Awaited<ReturnType<typeof claimJobs>> = [];
  try {
    await client.query("BEGIN");
    jobs = await claimJobs(client, "job-runner", 3);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    throw err;
  }
  client.release();

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      try {
        await processStoredEmail(job.emailRecordId);
        const c2 = await pool.connect();
        try {
          await c2.query("BEGIN");
          await completeJob(c2, job.jobId);
          await c2.query("COMMIT");
        } catch {
          await c2.query("ROLLBACK").catch(() => {});
          throw new Error("Failed to mark job complete");
        } finally {
          c2.release();
        }
        return { jobId: job.jobId, status: "completed" };
      } catch (err) {
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
        } catch {
          await c3.query("ROLLBACK").catch(() => {});
        } finally {
          c3.release();
        }
        return { jobId: job.jobId, status: "failed", error: String(err) };
      }
    }),
  );

  return NextResponse.json({
    processed: results.length,
    results: results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: r.reason },
    ),
  });
}
