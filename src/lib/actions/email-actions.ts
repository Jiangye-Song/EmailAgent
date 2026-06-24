"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function approveAction(recordId: string): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { rows } = await pool.query<{
    sender: string;
    subject: string;
    recommended_action: string;
    draft_body: string | null;
  }>(
    `SELECT sender, subject, recommended_action, draft_body
     FROM email_records
     WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  if (!rows.length) throw new Error("Record not found");

  const { sender, subject, recommended_action, draft_body } = rows[0];

  await pool.query(
    `UPDATE email_records SET action_status = 'executed' WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  revalidatePath("/inbox");

  if (recommended_action === "draft_reply") {
    const url =
      `mailto:${encodeURIComponent(sender)}` +
      `?subject=${encodeURIComponent(`Re: ${subject}`)}` +
      `&body=${encodeURIComponent(draft_body ?? "")}`;
    return url;
  }

  return undefined;
}

export async function rejectAction(recordId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await pool.query(
    `UPDATE email_records SET action_status = 'rejected' WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  revalidatePath("/inbox");
}
