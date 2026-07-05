import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";
import { InboxLayout } from "@/components/inbox/InboxLayout";
import type { EmailRecord } from "@/types/db";

type EmailRecordRow = EmailRecord & {
  message_domain: string | null;
  structured_extraction: {
    eventType?: string | null;
    company?: string | null;
    role?: string | null;
    evidence?: string[];
    deal?: {
      brand?: string | null;
      discountPercent?: number | null;
      offerType?: string | null;
    } | null;
  } | null;
};

function fallbackSummary(row: EmailRecordRow): string {
  if (row.summary?.trim()) return row.summary;

  const extraction = row.structured_extraction;
  if (!extraction) {
    if (row.raw_body?.trim()) {
      const firstLine = row.raw_body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
      if (firstLine) {
        return firstLine.length > 220 ? `${firstLine.slice(0, 217)}...` : firstLine;
      }
    }
    return "No summary available.";
  }

  if (row.message_domain === "deal" && extraction.deal) {
    const brand = extraction.deal.brand ?? "Deal";
    const offer = extraction.deal.discountPercent
      ? `${extraction.deal.discountPercent}% ${extraction.deal.offerType ?? "offer"}`
      : extraction.deal.offerType ?? "offer";
    return `${brand}: ${offer}.`;
  }

  if (row.message_domain === "job") {
    const eventType = (extraction.eventType ?? "update").replaceAll("_", " ");
    const company = extraction.company ? ` from ${extraction.company}` : "";
    const role = extraction.role ? ` for ${extraction.role}` : "";
    return `Job ${eventType}${company}${role}.`;
  }

  if (Array.isArray(extraction.evidence) && extraction.evidence[0]) {
    return extraction.evidence[0];
  }

  return "No summary available.";
}

async function getEmailRecords(userId: string): Promise<EmailRecord[]> {
  const { rows } = await pool.query<EmailRecordRow>(
    `SELECT id, message_id, subject, sender, received_at, category, summary,
            todos, action_buttons, is_read, is_starred,
            recommended_action, action_status, raw_body,
            draft_body, calendar_events, processed_at,
            message_domain, structured_extraction
     FROM email_records
     WHERE user_id = $1
     ORDER BY received_at DESC NULLS LAST
     LIMIT 200`,
    [userId],
  );

  return rows.map((row) => ({
    ...row,
    summary: fallbackSummary(row),
  }));
}

function buildCategoryCounts(records: EmailRecord[]): Record<string, number> {
  const unread = records.filter((record) => !record.is_read);
  const counts: Record<string, number> = {
    all: unread.length,
    starred: unread.filter((record) => record.is_starred).length,
  };
  for (const r of unread) {
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
