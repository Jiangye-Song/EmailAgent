import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { parseMimeEmail } from "@/lib/email/parser";
import {
  getUserByForwardingAddress,
  isSenderWhitelisted,
} from "@/lib/email/forwarding-address";
import {
  enqueueInboundEmail,
  computeContentHash,
} from "@/lib/jobs/email-jobs";

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

function validateSecret(incoming: string): boolean {
  const expected = process.env.CF_INBOUND_SECRET ?? "";
  if (!incoming || incoming.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cf-secret") ?? "";
  if (!validateSecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipient = req.headers.get("x-recipient") ?? "";
  if (!recipient) {
    return NextResponse.json({ error: "Missing X-Recipient" }, { status: 400 });
  }

  const user = await getUserByForwardingAddress(recipient);
  if (!user) {
    return NextResponse.json(
      { ok: true, skipped: "unknown_recipient" },
      { status: 202 },
    );
  }

  // Enforce body size limit
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawBuffer = Buffer.from(await req.arrayBuffer());
  if (rawBuffer.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let email;
  try {
    email = await parseMimeEmail(rawBuffer);
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 422 });
  }

  // Sender whitelist: optional preference signal — log, do not reject
  const senderAllowed = await isSenderWhitelisted(user.id, email.from);
  if (!senderAllowed) {
    console.log(
      `[inbound] sender not whitelisted (user=${user.id}, sender="${email.from}") — proceeding anyway`,
    );
  }

  // email.id is the Message-ID; email.date is an ISO 8601 string
  const messageId = email.id ?? `no-message-id-${Date.now()}`;
  const contentHash = computeContentHash(user.id, messageId, rawBuffer);

  const { emailRecordId, isDuplicate } = await enqueueInboundEmail({
    userId: user.id,
    messageId,
    subject: email.subject ?? null,
    sender: email.from,
    receivedAt: email.date ? new Date(email.date) : new Date(),
    contentHash,
    rawMime: rawBuffer,
    parsedBody: email.body ?? "",
  });

  return NextResponse.json(
    { ok: true, accepted: true, emailRecordId, isDuplicate },
    { status: 202 },
  );
}
