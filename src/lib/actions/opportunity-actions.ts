"use server";

import { revalidatePath } from "next/cache";
import { withTransaction } from "@/lib/db/transaction";

type ActionRow = {
  id: string;
  user_id: string;
  status: string;
  action_type: string;
  payload: Record<string, unknown>;
};

type ApproveResult = {
  status: "approved" | "executed";
  actionUrl?: string;
};

export async function approveAgentAction({
  actionId,
  userId,
}: {
  actionId: string;
  userId: string;
}): Promise<ApproveResult> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<ActionRow>(
      `SELECT id, user_id, status, action_type, payload
       FROM agent_actions
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [actionId, userId],
    );

    const action = rows[0];
    if (!action) throw new Error("Action not found or unauthorized");
    if (action.status === "executed") throw new Error("Action already executed");
    if (action.status === "rejected") throw new Error("Action already rejected");
    if (action.status !== "proposed") throw new Error("Action is not in proposed state");

    const EXTERNAL_ACTIONS = new Set([
      "prepare_calendar_event",
      "prepare_reply",
    ]);

    if (EXTERNAL_ACTIONS.has(action.action_type)) {
      // External actions: move to approved, return a safe URL for the user to act on
      await client.query(
        `UPDATE agent_actions
         SET status = 'approved', updated_at = now()
         WHERE id = $1`,
        [actionId],
      );

      let actionUrl: string;
      if (action.action_type === "prepare_calendar_event") {
        actionUrl = `/api/ics/action/${actionId}`;
      } else {
        // prepare_reply: build mailto link
        const p = action.payload;
        const to = encodeURIComponent(String(p.to ?? ""));
        const subject = encodeURIComponent(String(p.subject ?? ""));
        const body = encodeURIComponent(String(p.body ?? ""));
        actionUrl = `mailto:${to}?subject=${subject}&body=${body}`;
      }

      revalidatePath("/opportunities");
      return { status: "approved", actionUrl };
    }

    // Safe actions (schedule_reminder, etc.): mark executed
    await client.query(
      `UPDATE agent_actions
       SET status = 'executed', updated_at = now()
       WHERE id = $1`,
      [actionId],
    );

    revalidatePath("/opportunities");
    return { status: "executed" };
  });
}

export async function rejectAgentAction({
  actionId,
  userId,
}: {
  actionId: string;
  userId: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<ActionRow>(
      `SELECT id, user_id, status, action_type, payload
       FROM agent_actions
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [actionId, userId],
    );

    const action = rows[0];
    if (!action) throw new Error("Action not found or unauthorized");
    if (action.status === "rejected") return; // idempotent
    if (action.status === "executed") throw new Error("Cannot reject an executed action");

    await client.query(
      `UPDATE agent_actions
       SET status = 'rejected', updated_at = now()
       WHERE id = $1`,
      [actionId],
    );
  });

  revalidatePath("/opportunities");
}
