import { simpleParser } from "mailparser";
import { randomUUID } from "crypto";
import type { Email } from "@/types/email";

export async function parseMimeEmail(raw: Buffer | string): Promise<Email> {
  const parsed = await simpleParser(raw);

  const body =
    parsed.text ??
    (typeof parsed.html === "string"
      ? parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : "");

  return {
    id: parsed.messageId ?? randomUUID(),
    subject: parsed.subject ?? "(no subject)",
    from: parsed.from?.text ?? "",
    to: Array.isArray(parsed.to)
      ? parsed.to.map((a) => a.text).join(", ")
      : parsed.to?.text ?? "",
    date: parsed.date?.toISOString() ?? new Date().toISOString(),
    snippet: body.slice(0, 200),
    body,
    attachments: (parsed.attachments ?? []).map((a) => ({
      filename: a.filename ?? "attachment",
      mimeType: a.contentType,
      attachmentId: a.checksum ?? randomUUID(),
      size: a.size,
    })),
  };
}
