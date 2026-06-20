"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { getGoogleAccessToken } from "@/lib/tokens";
import { archiveEmail, createDraft } from "@/lib/mcp/gmail";

export async function approveAction(recordId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { rows } = await pool.query<{
    gmail_id: string;
    recommended_action: string;
  }>(
    `SELECT gmail_id, recommended_action
     FROM email_records
     WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  if (!rows.length) throw new Error("Record not found");

  const { gmail_id, recommended_action } = rows[0];
  const accessToken = await getGoogleAccessToken(session.user.id);

  if (recommended_action === "archive") {
    await archiveEmail(accessToken, gmail_id);
  } else if (recommended_action === "draft_reply") {
    await createDraft(accessToken, "", "Re: (email)", "");
  }

  await pool.query(
    `UPDATE email_records
     SET action_status = 'approved'
     WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  revalidatePath("/dashboard");
}

export async function rejectAction(recordId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await pool.query(
    `UPDATE email_records
     SET action_status = 'rejected'
     WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  revalidatePath("/dashboard");
}
