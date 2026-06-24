export type EmailRecord = {
  id: string;
  gmail_id: string;
  subject: string;
  sender: string;
  received_at: Date | null;
  category: "newsletter" | "alert" | "personal" | "promotion" | "other";
  summary: string;
  todos: string[];
  recommended_action: "archive" | "keep" | "draft_reply";
  action_status: "pending" | "approved" | "rejected" | "executed";
  raw_snippet: string;
  draft_body: string | null;
  calendar_events: CalendarEvent[];
  processed_at: Date;
};

export type CalendarEvent = {
  title: string;
  start: string;       // ISO 8601
  end?: string;        // ISO 8601
  description?: string;
  location?: string;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};
