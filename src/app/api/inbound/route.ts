import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { pool } from "@/lib/db";
import { parseMimeEmail } from "@/lib/email/parser";
import { processEmailsBatched } from "@/lib/ai/processor";
import { sendPushNotification } from "@/lib/push/notify";

function validateSecret(incoming: string): boolean {
  const expected = process.env.CF_INBOUND_SECRET ?? "";
  if (!incoming || incoming.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-cf-secret") ?? "";
  if (!validateSecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Recipient lookup ──────────────────────────────────────────────────────
  const recipient = req.headers.get("x-recipient") ?? "";
  if (!recipient) {
    return NextResponse.json({ error: "Missing X-Recipient" }, { status: 400 });
  }

  const userResult = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE forwarding_address = $1`,
    [recipient.toLowerCase()],
  );
  if (!userResult.rows.length) {
    return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
  }
  const userId = userResult.rows[0].id;

  // ── Parse MIME ────────────────────────────────────────────────────────────
  const rawBuffer = Buffer.from(await req.arrayBuffer());
  let email;
  try {
    email = await parseMimeEmail(rawBuffer);
  } catch (err) {
    console.error("[inbound] MIME parse error:", err);
    return NextResponse.json({ error: "Parse failed" }, { status: 422 });
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
  if (processed?.calendarEvents?.length) {
    await sendPushNotification(userId, {
      title: "Calendar event detected",
      body: email.subject,
    }).catch((err) => console.warn("[inbound] Push failed:", err));
  }

  return NextResponse.json({ ok: true, processed: results.length });
}
