import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { generateIcs } from "@/lib/ics/generate";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ actionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { actionId } = await params;

  const { rows } = await pool.query<{
    action_type: string;
    payload: { title: string; startAt: string; durationMinutes?: number; description?: string };
    status: string;
    user_id: string;
  }>(
    `SELECT action_type, payload, status, user_id
     FROM agent_actions
     WHERE id = $1`,
    [actionId],
  );

  const action = rows[0];
  if (!action || action.user_id !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (action.action_type !== "prepare_calendar_event") {
    return NextResponse.json({ error: "Not a calendar action" }, { status: 400 });
  }
  if (action.status !== "approved" && action.status !== "executed") {
    return NextResponse.json({ error: "Action not approved" }, { status: 403 });
  }

  const p = action.payload;
  const startAt = p.startAt;
  const endAt = p.durationMinutes
    ? new Date(
        new Date(startAt).getTime() + p.durationMinutes * 60 * 1000,
      ).toISOString()
    : undefined;

  const ics = generateIcs(
    [
      {
        title: p.title,
        start: startAt,
        end: endAt ?? "",
        description: p.description,
      },
    ],
    p.title,
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event.ics"`,
    },
  });
}
