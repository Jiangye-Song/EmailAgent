import type { Email, EmailAttachment } from "@/types/email";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

// ─── Gmail API response shapes ────────────────────────────────────────────────

type GmailHeader = { name: string; value: string };

type GmailPart = {
  mimeType: string;
  filename?: string;
  headers?: GmailHeader[];
  body: { data?: string; attachmentId?: string; size: number };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: GmailPart;
};

type GmailListResponse = {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getHeader(headers: GmailHeader[], name: string): string {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/** Recursively find the first text/plain part and decode it. */
function extractPlainText(part: GmailPart): string {
  if (part.mimeType === "text/plain" && part.body.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts) {
    for (const child of part.parts) {
      const text = extractPlainText(child);
      if (text) return text;
    }
  }
  return "";
}

/** Collect all named attachments (skips inline images with no filename). */
function extractAttachments(part: GmailPart): EmailAttachment[] {
  const result: EmailAttachment[] = [];
  if (part.filename && part.body.attachmentId) {
    result.push({
      filename: part.filename,
      mimeType: part.mimeType,
      attachmentId: part.body.attachmentId,
      size: part.body.size,
    });
  }
  for (const child of part.parts ?? []) {
    result.push(...extractAttachments(child));
  }
  return result;
}

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gmail API ${res.status} on ${path}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch unread emails for the authenticated user.
 * Messages are fetched concurrently with Promise.all for speed.
 */
export async function fetchUnreadEmails(
  accessToken: string,
  limit = 20,
): Promise<Email[]> {
  const list = await gmailFetch<GmailListResponse>(
    accessToken,
    `/messages?q=is:unread&maxResults=${limit}`,
  );

  if (!list.messages?.length) return [];

  const messages = await Promise.all(
    list.messages.map((m) =>
      gmailFetch<GmailMessage>(
        accessToken,
        `/messages/${m.id}?format=full`,
      ),
    ),
  );

  return messages.map((msg): Email => {
    const headers = msg.payload.headers ?? [];
    return {
      id: msg.id,
      threadId: msg.threadId,
      subject: getHeader(headers, "Subject") || "(no subject)",
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      date: getHeader(headers, "Date"),
      snippet: msg.snippet,
      body: extractPlainText(msg.payload).trim(),
      attachments: extractAttachments(msg.payload),
      labelIds: msg.labelIds ?? [],
    };
  });
}

/**
 * Archive an email by removing the INBOX label.
 */
export async function archiveEmail(
  accessToken: string,
  id: string,
): Promise<{ success: boolean }> {
  await gmailFetch(accessToken, `/messages/${id}/modify`, {
    method: "POST",
    body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
  });
  return { success: true };
}

/**
 * Create a Gmail draft from a plain-text body.
 */
export async function createDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
): Promise<{ success: boolean; draftId?: string }> {
  // Build a minimal RFC 2822 message and base64url-encode it
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join("\r\n");

  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await gmailFetch<{ id: string }>(accessToken, `/drafts`, {
    method: "POST",
    body: JSON.stringify({ message: { raw: encoded } }),
  });

  return { success: true, draftId: result.id };
}
