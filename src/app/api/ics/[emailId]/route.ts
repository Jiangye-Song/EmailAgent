import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { generateIcs } from "@/lib/ics/generate";
import type { CalendarEvent } from "@/types/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { emailId } = await params;

  const { rows } = await pool.query<{
    subject: string;
    calendar_events: CalendarEvent[];
  }>(
    `SELECT subject, calendar_events FROM email_records WHERE id = $1 AND user_id = $2`,
    [emailId, session.user.id],
  );

  if (!rows.length) return new NextResponse("Not found", { status: 404 });

  const { subject, calendar_events } = rows[0];
  if (!calendar_events?.length) {
    return new NextResponse("No calendar events", { status: 404 });
  }

  const eventIndexParam = _req.nextUrl.searchParams.get("eventIndex");
  const eventIndex =
    eventIndexParam === null ? null : Number.parseInt(eventIndexParam, 10);
  const selectedEvents =
    eventIndex === null
      ? calendar_events
      : Number.isInteger(eventIndex) &&
          eventIndex >= 0 &&
          eventIndex < calendar_events.length
        ? [calendar_events[eventIndex]]
        : null;

  if (!selectedEvents) {
    return new NextResponse("No calendar events", { status: 404 });
  }

  const ics = generateIcs(selectedEvents, subject);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event.ics"`,
    },
  });
}
