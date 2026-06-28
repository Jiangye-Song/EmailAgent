import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";
import { InboxLayout } from "@/components/inbox/InboxLayout";
import type { EmailRecord } from "@/types/db";

async function getEmailRecords(userId: string): Promise<EmailRecord[]> {
  const { rows } = await pool.query<EmailRecord>(
    `SELECT id, message_id, subject, sender, received_at, category, summary,
            todos, recommended_action, action_status, raw_body,
            draft_body, calendar_events, processed_at
     FROM email_records
     WHERE user_id = $1
     ORDER BY received_at DESC NULLS LAST
     LIMIT 200`,
    [userId],
  );
  return rows;
}

function buildCategoryCounts(records: EmailRecord[]): Record<string, number> {
  const counts: Record<string, number> = { all: records.length };
  for (const r of records) {
    counts[r.category] = (counts[r.category] ?? 0) + 1;
  }
  return counts;
}

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [records, forwardingAddress] = await Promise.all([
    getEmailRecords(session.user.id),
    ensureForwardingAddress(session.user.id),
  ]);

  const categoryCounts = buildCategoryCounts(records);

  return (
    <InboxLayout
      records={records}
      categoryCounts={categoryCounts}
      forwardingAddress={forwardingAddress}
    />
  );
}
