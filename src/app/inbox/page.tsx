import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { embed } from "ai";
import { pool } from "@/lib/db";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";
import { InboxLayout } from "@/components/inbox/InboxLayout";
import { qwenEmbedding } from "@/lib/ai/qwen";
import type { EmailRecord } from "@/types/db";

type UserCategoryRow = {
  categoryKey: string;
  displayName: string;
};

async function getOnboardingCompleted(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ onboarding_completed: boolean }>(
    `SELECT onboarding_completed FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.onboarding_completed ?? false;
}

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

async function searchEmailRecords(userId: string, searchQuery: string): Promise<EmailRecord[]> {
  const { embedding } = await embed({
    model: qwenEmbedding,
    value: searchQuery,
  });

  const vectorLiteral = `[${embedding.join(",")}]`;

  const { rows } = await pool.query<EmailRecord>(
    `SELECT id, message_id, subject, sender, received_at,
            COALESCE(NULLIF(category, ''), 'other') AS category,
            todos, action_buttons, is_read, is_starred,
            is_priority, recommended_action, action_status, raw_body,
            draft_body, calendar_events, processed_at
     FROM email_records
     WHERE user_id = $1 AND embedding IS NOT NULL
     ORDER BY embedding <=> $2::vector ASC
     LIMIT 200`,
    [userId, vectorLiteral],
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

type InboxPageProps = {
  searchParams?:
    | Promise<{
        q?: string | string[];
      }>
    | {
        q?: string | string[];
      };
};

function normalizeSearchQuery(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue?.trim() ?? "";
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const resolvedSearchParams = await (searchParams ?? {});
  const searchQuery = normalizeSearchQuery(resolvedSearchParams.q);

  const onboardingCompleted = await getOnboardingCompleted(session.user.id);
  if (!onboardingCompleted) redirect("/onboarding");

  const [allRecords, forwardingAddress, userCategories] = await Promise.all([
    getEmailRecords(session.user.id),
    ensureForwardingAddress(session.user.id),
    getUserCategories(session.user.id),
  ]);

  const records =
    searchQuery.length >= 2
      ? await searchEmailRecords(session.user.id, searchQuery)
      : allRecords;

  const categoryCounts = buildCategoryCounts(allRecords);
  const sidebarCategories = buildSidebarCategories(userCategories, categoryCounts);

  return (
    <InboxLayout
      records={records}
      searchQuery={searchQuery}
      categoryCounts={categoryCounts}
      userCategories={sidebarCategories}
      forwardingAddress={forwardingAddress}
    />
  );
}
