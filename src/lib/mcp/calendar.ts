const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarDateTime = {
  dateTime: string; // ISO 8601
  timeZone?: string;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: CalendarDateTime;
  end: CalendarDateTime;
  attendees?: { email: string; displayName?: string }[];
  htmlLink?: string;
};

export type NewCalendarEvent = Omit<CalendarEvent, "id" | "htmlLink">;

// ─── Public API (stubs — real implementation in Phase 5) ─────────────────────

/**
 * Fetch the next N upcoming events from the user's primary calendar.
 * Stub: returns [] until Phase 5.
 */
export async function fetchUpcomingEvents(
  _accessToken: string,
  maxResults = 10,
): Promise<CalendarEvent[]> {
  // Phase 5: GET /calendars/primary/events?orderBy=startTime&singleEvents=true
  //          &timeMin=<now>&maxResults=<n>
  console.log(`[stub] fetchUpcomingEvents maxResults=${maxResults}`);
  void CALENDAR_API; // suppress unused import warning until Phase 5
  return [];
}

/**
 * Create a new event on the user's primary calendar.
 * Stub: returns success until Phase 5.
 */
export async function createEvent(
  _accessToken: string,
  event: NewCalendarEvent,
): Promise<{ success: boolean; eventId?: string }> {
  // Phase 5: POST /calendars/primary/events with the event body
  console.log(`[stub] createEvent "${event.summary}"`);
  return { success: true };
}
