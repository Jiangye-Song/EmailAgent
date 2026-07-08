import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { pool } from "@/lib/db";
import { parseMimeEmail } from "@/lib/email/parser";
import {
  getUserByForwardingAddress,
  isSenderWhitelisted,
} from "@/lib/email/forwarding-address";
import { processEmailsBatched } from "@/lib/ai/processor";
import { sendPushNotification } from "@/lib/push/notify";

function validateSecret(incoming: string): boolean {
  const expected = process.env.CF_INBOUND_SECRET ?? "";
  if (!incoming || incoming.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  // ── Debug ─────────────────────────────────────────────────────────────────
  const incoming = req.headers.get("x-cf-secret") ?? "(none)";
  const expected = process.env.CF_INBOUND_SECRET ?? "(not set)";
  console.log(`[inbound] POST reached — secret header: "${incoming.slice(0, 6)}…" expected length: ${expected.length}`);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-cf-secret") ?? "";
  if (!validateSecret(secret)) {
    console.log(`[inbound] 401 — secret mismatch (incoming.length=${secret.length}, expected.length=${expected.length})`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Recipient lookup ──────────────────────────────────────────────────────
  const recipient = req.headers.get("x-recipient") ?? "";
  if (!recipient) {
    return NextResponse.json({ error: "Missing X-Recipient" }, { status: 400 });
  }

  console.log(`[inbound] recipient header: "${recipient}"`);

  const user = await getUserByForwardingAddress(recipient);
  if (!user) {
    console.log(`[inbound] 202 — unknown recipient skipped: "${recipient}"`);
    // Don't hard-fail unknown recipients; providers may still route stale forwarding targets.
    return NextResponse.json(
      { ok: true, skipped: "unknown_recipient" },
      { status: 202 },
    );
  }
  const userId = user.id;

  // ── Parse MIME ────────────────────────────────────────────────────────────
  const rawBuffer = Buffer.from(await req.arrayBuffer());
  let email;
  try {
    email = await parseMimeEmail(rawBuffer);
  } catch (err) {
    console.error("[inbound] MIME parse error:", err);
    return NextResponse.json({ error: "Parse failed" }, { status: 422 });
  }

  // ── Sender whitelist check ───────────────────────────────────────────────
  const senderAllowed = await isSenderWhitelisted(userId, email.from);
  if (!senderAllowed) {
    console.log(
      `[inbound] skipped: sender not whitelisted (user=${userId}, sender="${email.from}")`,
    );
    return NextResponse.json({ ok: true, skipped: "sender_not_whitelisted" }, { status: 202 });
  }

  // ── Load user rules ───────────────────────────────────────────────────────
  const rulesResult = await pool.query<{ rule_text: string }>(
    `SELECT rule_text FROM user_rules WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  const userRules = rulesResult.rows.map((r) => r.rule_text);

  // ── Run AI pipeline ───────────────────────────────────────────────────────
  const { results } = await processEmailsBatched([email], userId, userRules);

  // ── Push notification for calendar events ─────────────────────────────────
  const processed = results[0];
  if (processed?.isPriority) {
    await sendPushNotification(userId, {
      title: "Priority email",
      body: email.subject,
    }).catch((err) => console.warn("[inbound] Push failed:", err));
  } else if (processed?.ruleMatches?.length) {
    await sendPushNotification(userId, {
      title: "Rules triggered",
      body: email.subject,
    }).catch((err) => console.warn("[inbound] Push failed:", err));
  }

  return NextResponse.json({ ok: true, processed: results.length });
}
