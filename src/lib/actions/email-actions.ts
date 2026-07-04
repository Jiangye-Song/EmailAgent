"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function toggleStarEmail(recordId: string): Promise<void> {
  const userId = await getUserId();

  await pool.query(
    `UPDATE email_records
     SET is_starred = NOT is_starred
     WHERE id = $1 AND user_id = $2`,
    [recordId, userId],
  );

  revalidatePath("/inbox");
}

export async function markEmailRead(recordId: string): Promise<void> {
  const userId = await getUserId();

  await pool.query(
    `UPDATE email_records
     SET is_read = true
     WHERE id = $1 AND user_id = $2`,
    [recordId, userId],
  );

  revalidatePath("/inbox");
}

export async function markEmailUnread(recordId: string): Promise<void> {
  const userId = await getUserId();

  await pool.query(
    `UPDATE email_records
     SET is_read = false
     WHERE id = $1 AND user_id = $2`,
    [recordId, userId],
  );

  revalidatePath("/inbox");
}

export async function removeEmail(recordId: string): Promise<void> {
  const userId = await getUserId();

  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM email_records
       WHERE id = $1 AND user_id = $2`,
      [recordId, userId],
    );

    await client.query(
      `UPDATE digest_exports
       SET payload = jsonb_set(
         payload,
         '{emails}',
         COALESCE(
           (
             SELECT jsonb_agg(item)
             FROM jsonb_array_elements(COALESCE(payload->'emails', '[]'::jsonb)) AS item
             WHERE item->>'emailId' <> $1
           ),
           '[]'::jsonb
         ),
         true
       )
       WHERE user_id = $2
         AND jsonb_typeof(COALESCE(payload->'emails', '[]'::jsonb)) = 'array'`,
      [recordId, userId],
    );
  });

  revalidatePath("/inbox");
}
