// ─── Core email types used across the whole pipeline ─────────────────────────

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
};

export type Email = {
  /** Message-ID header or generated UUID */
  id: string;
  subject: string;
  from: string;
  to: string;
  /** ISO 8601 date string */
  date: string;
  /** Short plain-text preview (first 200 chars) */
  snippet: string;
  /** Full plain-text body */
  body: string;
  attachments: EmailAttachment[];
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
  /** User rules triggered */
  ruleMatches?: string[];
};
