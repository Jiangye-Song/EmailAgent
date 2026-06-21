import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import type { ImapCredentials } from "@/lib/credentials";
import type { Email, EmailAttachment } from "@/types/email";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeClient(creds: ImapCredentials): ImapFlow {
  return new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapPort === 993,
    auth: { user: creds.username, pass: creds.password },
    logger: false,
  });
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch the most recent unread messages from INBOX via IMAP.
 * Uses imapflow for the connection and mailparser for MIME decoding.
 */
export async function fetchUnreadEmails(
  creds: ImapCredentials,
  limit = 20,
): Promise<Email[]> {
  const client = makeClient(creds);
  await client.connect();

  const emails: Email[] = [];
  const lock = await client.getMailboxLock("INBOX");

  try {
    // UIDs of unseen messages; take the latest `limit` entries
    const uids = await client.search({ seen: false }, { uid: true });
    if (uids === false || uids.length === 0) return [];
    const recentUids = uids.slice(-limit);

    for await (const msg of client.fetch(
      recentUids,
      { source: true, uid: true, flags: true },
      { uid: true },
    )) {
      if (!msg.source) continue;

      const parsed = await simpleParser(msg.source);

      const fromAddr = parsed.from?.value?.[0];
      // mailparser's `to` can be AddressObject or AddressObject[]
      const toObj = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
      const toAddr = toObj?.value?.[0];

      const fromStr = fromAddr
        ? fromAddr.name
          ? `${fromAddr.name} <${fromAddr.address}>`
          : (fromAddr.address ?? "")
        : "";

      const toStr = toAddr
        ? toAddr.name
          ? `${toAddr.name} <${toAddr.address}>`
          : (toAddr.address ?? "")
        : "";

      // Skip inline images; keep only named attachments
      const attachments: EmailAttachment[] = (parsed.attachments ?? [])
        .filter((a) => !a.related)
        .map(
          (a): EmailAttachment => ({
            filename:
              typeof a.filename === "string" ? a.filename : "attachment",
            mimeType: a.contentType,
            sectionPath: a.cid ?? "",
            size: a.size ?? a.content.byteLength,
          }),
        );

      const body =
        parsed.text ??
        (parsed.html ? parsed.html.replace(/<[^>]+>/g, " ") : "");

      emails.push({
        id: String(msg.uid),
        threadId: parsed.inReplyTo ?? String(msg.uid),
        subject: parsed.subject ?? "(no subject)",
        from: fromStr,
        to: toStr,
        date: parsed.date?.toISOString() ?? new Date().toISOString(),
        snippet: body.slice(0, 200).replace(/\s+/g, " ").trim(),
        body,
        attachments,
        flags: [...(msg.flags ?? new Set<string>())],
      });
    }
  } finally {
    lock.release();
  }

  await client.logout();
  return emails;
}

/**
 * Move a message out of INBOX by UID.
 * Tries common archive folder names and falls back to marking as read.
 */
export async function archiveEmail(
  creds: ImapCredentials,
  uid: string,
): Promise<{ success: boolean }> {
  const client = makeClient(creds);
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const ARCHIVE_FOLDERS = [
      "Archive",
      "[Gmail]/All Mail",
      "INBOX.Archive",
      "Archived",
    ];
    let moved = false;
    for (const folder of ARCHIVE_FOLDERS) {
      try {
        await client.messageMove(Number(uid), folder, { uid: true });
        moved = true;
        break;
      } catch {
        // Folder doesn't exist on this server — try next
      }
    }
    if (!moved) {
      // Fallback: mark as read so it won't be re-fetched as unread
      await client.messageFlagsAdd(Number(uid), ["\\Seen"], { uid: true });
    }
  } finally {
    lock.release();
  }

  await client.logout();
  return { success: true };
}

/**
 * Mark a message as read by adding the \Seen IMAP flag.
 */
export async function markAsRead(
  creds: ImapCredentials,
  uid: string,
): Promise<{ success: boolean }> {
  const client = makeClient(creds);
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    await client.messageFlagsAdd(Number(uid), ["\\Seen"], { uid: true });
  } finally {
    lock.release();
  }

  await client.logout();
  return { success: true };
}

/**
 * Save a draft by APPENDing a raw RFC 2822 message to the Drafts folder.
 * Falls back to common folder names for different providers.
 */
export async function createDraft(
  creds: ImapCredentials,
  to: string,
  subject: string,
  body: string,
): Promise<{ success: boolean; uid?: number }> {
  // Build raw RFC 2822 message using nodemailer's stream transport
  const transport = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
  });
  const info = await transport.sendMail({
    from: creds.username,
    to: to || creds.username,
    subject,
    text: body,
  });
  const raw = await streamToBuffer(
    info.message as unknown as NodeJS.ReadableStream,
  );

  const client = makeClient(creds);
  await client.connect();

  const DRAFT_FOLDERS = [
    "Drafts",
    "[Gmail]/Drafts",
    "INBOX.Drafts",
    "Draft",
    "Sent",
  ];
  let appendUid: number | undefined;
  for (const folder of DRAFT_FOLDERS) {
    try {
      const result = await client.append(folder, raw, ["\\Draft", "\\Seen"]);
      appendUid = result !== false ? result.uid : undefined;
      break;
    } catch {
      // Folder not found on this server — try next
    }
  }

  await client.logout();
  return { success: true, uid: appendUid };
}
