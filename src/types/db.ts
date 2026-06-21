// DB row type returned by email_records queries
export type EmailRecord = {
  id: string;
  message_id: string;
  subject: string;
  sender: string;
  received_at: Date | null;
  category: "newsletter" | "alert" | "personal" | "promotion" | "other";
  summary: string;
  todos: string[];
  recommended_action: "archive" | "keep" | "draft_reply";
  action_status: "pending" | "approved" | "rejected" | "executed";
  raw_snippet: string;
  processed_at: Date;
};
