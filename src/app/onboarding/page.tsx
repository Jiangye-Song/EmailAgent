import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { pool } from "@/lib/db";

async function getOnboardingCompleted(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ onboarding_completed: boolean }>(
    `SELECT onboarding_completed FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.onboarding_completed ?? false;
}

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const onboardingCompleted = await getOnboardingCompleted(session.user.id);
  if (onboardingCompleted) redirect("/inbox");

  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return <OnboardingWizard userName={firstName} />;
}
