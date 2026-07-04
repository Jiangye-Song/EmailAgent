import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { rows } = await pool.query<{ onboarding_completed: boolean }>(
    "SELECT onboarding_completed FROM users WHERE id = $1",
    [session.user.id],
  );

  if (rows[0]?.onboarding_completed) {
    redirect("/opportunities");
  } else {
    redirect("/onboarding");
  }
}
