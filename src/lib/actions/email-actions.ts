"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function approveAction(recordId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await pool.query(
    `UPDATE email_records
     SET action_status = 'approved'
     WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  revalidatePath("/inbox");
}

export async function rejectAction(recordId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await pool.query(
    `UPDATE email_records
     SET action_status = 'rejected'
     WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  revalidatePath("/inbox");
}
