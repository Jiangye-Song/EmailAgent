import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGoogleAccessToken } from "@/lib/tokens";
import { fetchUnreadEmails } from "@/lib/mcp/gmail";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit: number = typeof body.limit === "number" ? body.limit : 20;

  const accessToken = await getGoogleAccessToken(session.user.id);
  const emails = await fetchUnreadEmails(accessToken, limit);

  // Phase 3 will pipe emails → processEmailsBatched() → PolarDB
  return NextResponse.json({ count: emails.length, emails });
}
