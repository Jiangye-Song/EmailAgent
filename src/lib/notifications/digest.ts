import { pool } from "@/lib/db";

export type DigestEvent = {
  opportunityId: string;
  company: string;
  role: string;
  eventType: string;
  eventAt: string | null;
};

export type DailyDigest = {
  userId: string;
  events: DigestEvent[];
  since: Date;
};

export async function buildDailyDigest(
  userId: string,
  since: Date,
): Promise<DailyDigest> {
  const { rows } = await pool.query<{
    opportunity_id: string;
    company: string;
    role: string;
    event_type: string;
    event_at: string | null;
  }>(
    `SELECT oe.opportunity_id, o.company, o.role, oe.event_type, oe.event_at
     FROM opportunity_events oe
     JOIN opportunities o ON o.id = oe.opportunity_id
     WHERE o.user_id = $1
       AND oe.created_at >= $2
       AND oe.digest_sent_at IS NULL
       AND oe.confirmation_status = 'automatic'
     ORDER BY oe.created_at ASC`,
    [userId, since],
  );

  return {
    userId,
    events: rows.map((r) => ({
      opportunityId: r.opportunity_id,
      company: r.company,
      role: r.role,
      eventType: r.event_type,
      eventAt: r.event_at,
    })),
    since,
  };
}

export async function markDigestSent(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  await pool.query(
    `UPDATE opportunity_events
     SET digest_sent_at = now()
     WHERE id = ANY($1::uuid[])`,
    [eventIds],
  );
}
