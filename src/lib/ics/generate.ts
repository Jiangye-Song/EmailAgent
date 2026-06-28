import type { CalendarEvent } from "@/types/db";

function fmtDt(iso: string): string {
  // Convert ISO 8601 to iCal DTSTART format: 20240101T120000Z
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z");
}

export function generateIcs(events: CalendarEvent[], emailSubject: string): string {
  const uid = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2)}@emailagent`;

  const vevents = events
    .map((e) => {
      const lines = [
        "BEGIN:VEVENT",
        `UID:${uid()}`,
        `DTSTAMP:${fmtDt(new Date().toISOString())}`,
        `DTSTART:${fmtDt(e.start)}`,
        e.end ? `DTEND:${fmtDt(e.end)}` : "",
        `SUMMARY:${e.title}`,
        e.description ? `DESCRIPTION:${e.description.replace(/\n/g, "\\n")}` : "",
        e.location ? `LOCATION:${e.location}` : "",
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
      return lines;
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EmailAgent//EN",
    `X-WR-CALNAME:${emailSubject}`,
    vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}
