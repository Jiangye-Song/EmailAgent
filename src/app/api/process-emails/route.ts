import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGoogleAccessToken } from "@/lib/tokens";
import { fetchUnreadEmails } from "@/lib/mcp/gmail";
import { processEmailsBatched, saveDailyDigest } from "@/lib/ai/processor";
import { pool } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const limit: number = typeof body.limit === "number" ? body.limit : 20;

  // Fetch user-defined rules (Phase 5 — empty array until rules are saved)
  const { rows: ruleRows } = await pool.query<{ rule_text: string }>(
    `SELECT rule_text FROM user_rules WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  const userRules = ruleRows.map((r) => r.rule_text);

  const accessToken = await getGoogleAccessToken(userId);
  const emails = await fetchUnreadEmails(accessToken, limit);

  if (emails.length === 0) {
    return NextResponse.json({ message: "No unread emails found.", count: 0 });
  }

  const { results, errors } = await processEmailsBatched(
    emails,
    userId,
    userRules,
  );

  await saveDailyDigest(userId, results);

  return NextResponse.json({
    processed: results.length,
    errors: errors.length,
    errorDetails: errors.length > 0 ? errors : undefined,
    results,
  });
}

