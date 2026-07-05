import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { DealList } from "@/components/deals/DealList";
import { InboxLayout } from "@/components/inbox/InboxLayout";

type DealRow = {
  id: string;
  brand: string;
  offer_type: string;
  offer_value: string | null;
  expires_at: string | null;
  matched_rule: string;
  relevance_reason: string;
  created_at: string;
};

export default async function DealsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { rows } = await pool.query<DealRow>(
    `SELECT id, brand, offer_type, offer_value, expires_at,
            matched_rule, relevance_reason, created_at
     FROM valuable_deals
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [session.user.id],
  );

  return (
    <InboxLayout
      activePanel="deals"
      panelContent={<DealList deals={rows} />}
    />
  );
}
