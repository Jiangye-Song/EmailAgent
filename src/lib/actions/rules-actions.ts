"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function saveRules(rules: string[]): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    // Replace all rules for this user atomically
    await client.query(`DELETE FROM user_rules WHERE user_id = $1`, [userId]);
    for (const text of rules.filter((r) => r.trim())) {
      await client.query(
        `INSERT INTO user_rules (user_id, rule_text) VALUES ($1, $2)`,
        [userId, text.trim()],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/settings");
}
