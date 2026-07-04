import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getOpportunityBoard } from "@/lib/opportunities/board-query";
import { OpportunityBoardView } from "@/components/opportunities/OpportunityBoard";

export default async function OpportunitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Redirect users who haven't completed onboarding
  const { rows } = await pool.query<{ onboarding_completed: boolean }>(
    "SELECT onboarding_completed FROM users WHERE id = $1",
    [session.user.id],
  );
  if (!rows[0]?.onboarding_completed) redirect("/onboarding");

  const board = await getOpportunityBoard(session.user.id);

  return <OpportunityBoardView board={board} />;
}
