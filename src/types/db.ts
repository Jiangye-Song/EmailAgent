// ─── Calendar event (from AI calendar parsing) ───────────────────────────────
export type CalendarEvent = {
  title: string;
  start: string;          // ISO 8601
  end?: string;           // ISO 8601
  description?: string;
  location?: string;
};

export type EmailActionButton = {
  label: string;
  kind: "url" | "star" | "remove" | "reply";
  href?: string;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
};

// ─── DB row type returned by email_records queries ───────────────────────────
export type EmailRecord = {
  id: string;
  message_id: string;
  subject: string;
  sender: string;
  received_at: Date | null;
  category: "newsletter" | "alert" | "personal" | "promotion" | "other";
  summary: string;
  todos: string[];
  action_buttons?: EmailActionButton[];
  is_read: boolean;
  is_starred: boolean;
  recommended_action: "archive" | "keep" | "draft_reply";
  action_status: "pending" | "approved" | "rejected" | "executed";
  raw_body: string | null;
  draft_body?: string | null;
  calendar_events?: CalendarEvent[];
  processed_at: Date;
};
