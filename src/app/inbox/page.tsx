import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";
import { InboxLayout } from "@/components/inbox/InboxLayout";
import type { EmailRecord } from "@/types/db";

type UserCategoryRow = {
  categoryKey: string;
  displayName: string;
};

async function getEmailRecords(userId: string): Promise<EmailRecord[]> {
  const { rows } = await pool.query<EmailRecord>(
    `SELECT id, message_id, subject, sender, received_at,
            COALESCE(NULLIF(category, ''), 'other') AS category,
            todos, action_buttons, is_read, is_starred,
            is_priority, recommended_action, action_status, raw_body,
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
  const unread = records.filter((record) => !record.is_read);
  const counts: Record<string, number> = {
    all: unread.length,
    starred: unread.filter((record) => record.is_starred).length,
  };
  for (const r of unread) {
    const category = r.category?.trim() ? r.category : "other";
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}

async function getUserCategories(userId: string): Promise<UserCategoryRow[]> {
  const { rows } = await pool.query<{ category_key: string; display_name: string }>(
    `SELECT category_key, display_name
     FROM user_categories
     WHERE user_id = $1 AND is_active = true
     ORDER BY created_at ASC`,
    [userId],
  );

  return rows.map((row) => ({
    categoryKey: row.category_key,
    displayName: row.display_name,
  }));
}

function buildSidebarCategories(
  userCategories: UserCategoryRow[],
  categoryCounts: Record<string, number>,
): UserCategoryRow[] {
  const fromUser = [...userCategories];
  const known = new Set(fromUser.map((item) => item.categoryKey));

  for (const categoryKey of Object.keys(categoryCounts)) {
    if (categoryKey === "all" || categoryKey === "starred") continue;
    if (known.has(categoryKey)) continue;

    fromUser.push({
      categoryKey,
      displayName: categoryKey
        .split(/[-_\s]+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    });
  }

  return fromUser;
}

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [records, forwardingAddress, userCategories] = await Promise.all([
    getEmailRecords(session.user.id),
    ensureForwardingAddress(session.user.id),
    getUserCategories(session.user.id),
  ]);

  const categoryCounts = buildCategoryCounts(records);
  const sidebarCategories = buildSidebarCategories(userCategories, categoryCounts);

  return (
    <InboxLayout
      records={records}
      categoryCounts={categoryCounts}
      userCategories={sidebarCategories}
      forwardingAddress={forwardingAddress}
    />
  );
}
