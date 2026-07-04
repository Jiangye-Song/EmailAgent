import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { parseMimeEmail } from "@/lib/email/parser";
import { getUserByForwardingAddress } from "@/lib/email/forwarding-address";
import { enqueueInboundEmail, computeContentHash } from "@/lib/jobs/email-jobs";

const FIXTURE_NAMES = z.enum([
  "application",
  "assessment",
  "interview",
  "rejection",
  "prompt-injection",
]);

function validateReplaySecret(incoming: string): boolean {
  const expected = process.env.DEMO_REPLAY_SECRET ?? "";
  if (!incoming || !expected || incoming.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!validateReplaySecret(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fixtureResult = FIXTURE_NAMES.safeParse(body.fixture);
  if (!fixtureResult.success) {
    return NextResponse.json(
      { error: "Invalid fixture", valid: FIXTURE_NAMES.options },
      { status: 400 },
    );
  }

  const recipient = (body.recipient as string) ?? "";
  if (!recipient) {
    return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
  }

  const user = await getUserByForwardingAddress(recipient);
  if (!user) {
    return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
  }

  const fixturePath = join(
    process.cwd(),
    "tests/fixtures/emails",
    `${fixtureResult.data}.eml`,
  );

  let rawBuffer: Buffer;
  try {
    rawBuffer = readFileSync(fixturePath);
  } catch {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  // Inject a unique replay message ID so this replay is not a duplicate
  const replayId = `replay-${randomBytes(8).toString("hex")}@emailagent-demo`;
  const replayBuffer = Buffer.from(
    rawBuffer.toString("utf8").replace(
      /^Message-ID:.*$/m,
      `Message-ID: <${replayId}>`,
    ),
  );

  let email;
  try {
    email = await parseMimeEmail(replayBuffer);
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 422 });
  }

  const contentHash = computeContentHash(user.id, replayId, replayBuffer);

  const { emailRecordId } = await enqueueInboundEmail({
    userId: user.id,
    messageId: replayId,
    subject: email.subject ?? null,
    sender: email.from,
    receivedAt: new Date(),
    contentHash,
    rawMime: replayBuffer,
    parsedBody: email.body ?? "",
  });

  return NextResponse.json({
    ok: true,
    emailRecordId,
    fixture: fixtureResult.data,
    replayId,
  });
}
