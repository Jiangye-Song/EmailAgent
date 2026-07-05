import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getOpportunityBoard } from "@/lib/opportunities/board-query";
import { OpportunityBoardView } from "@/components/opportunities/OpportunityBoard";
import { InboxLayout } from "@/components/inbox/InboxLayout";

export default async function OpportunitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { rows } = await pool.query<{ onboarding_completed: boolean }>(
    "SELECT onboarding_completed FROM users WHERE id = $1",
    [session.user.id],
  );
  const onboardingCompleted = rows[0]?.onboarding_completed ?? false;
  const board = onboardingCompleted
    ? await getOpportunityBoard(session.user.id)
    : null;

  return (
    <InboxLayout
      activePanel="opportunities"
      panelContent={
        <OpportunityBoardView
          board={board}
          onboardingCompleted={onboardingCompleted}
        />
      }
    />
  );
}
