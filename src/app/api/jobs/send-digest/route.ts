import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { buildDailyDigest } from "@/lib/notifications/digest";
import { sendPushNotification } from "@/lib/push/notify";

function validateSecret(incoming: string): boolean {
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
  if (!validateSecret(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hours

  // Get active users in batches of 50
  const { rows: users } = await pool.query<{ id: string }>(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN opportunity_events oe ON oe.opportunity_id IN (
       SELECT id FROM opportunities WHERE user_id = u.id
     )
     WHERE oe.created_at >= $1
       AND oe.digest_sent_at IS NULL
       AND oe.confirmation_status = 'automatic'
     LIMIT 50`,
    [since],
  );

  const results = await Promise.allSettled(
    users.map(async (user) => {
      const digest = await buildDailyDigest(user.id, since);
      if (digest.events.length === 0) return;

      // Send push if possible
      try {
        await sendPushNotification(user.id, {
          title: "Opportunity updates",
          body: `${digest.events.length} new job event(s) since yesterday`,
        });
      } catch {
        // VAPID not configured — skip
      }

      // Mark digest sent
      const { rows: eventRows } = await pool.query<{ id: string }>(
        `SELECT oe.id
         FROM opportunity_events oe
         JOIN opportunities o ON o.id = oe.opportunity_id
         WHERE o.user_id = $1
           AND oe.created_at >= $2
           AND oe.digest_sent_at IS NULL
           AND oe.confirmation_status = 'automatic'`,
        [user.id, since],
      );
      const eventIds = eventRows.map((r) => r.id);
      if (eventIds.length > 0) {
        await pool.query(
          `UPDATE opportunity_events SET digest_sent_at = now() WHERE id = ANY($1::uuid[])`,
          [eventIds],
        );
      }
    }),
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ processed: users.length, successful, failed });
}
