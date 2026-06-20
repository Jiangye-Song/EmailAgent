// ─── Core email types used across the whole pipeline ─────────────────────────

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  /** Gmail attachment ID — use to download via Gmail API if needed */
  attachmentId: string;
  size: number;
};

export type Email = {
  /** Gmail message ID */
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  /** RFC 2822 date string from the message header */
  date: string;
  /** Short plain-text preview provided by Gmail */
  snippet: string;
  /** Full plain-text body (decoded from MIME parts) */
  body: string;
  attachments: EmailAttachment[];
  labelIds: string[];
};

// ─── AI processing output ────────────────────────────────────────────────────

export type EmailCategory =
  | "newsletter"
  | "alert"
  | "personal"
  | "promotion"
  | "other";

export type RecommendedAction = "archive" | "keep" | "draft_reply";

export type ProcessedEmail = {
  emailId: string;
  category: EmailCategory;
  /** ≤ 2 sentence summary */
  summary: string;
  /** Extracted action items */
  todos: string[];
  recommendedAction: RecommendedAction;
  /** User rules triggered (Phase 5) */
  ruleMatches?: string[];
};
