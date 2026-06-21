import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ImapFlow } from "imapflow";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { imapHost, imapPort, username, password } = body as Record<
    string,
    unknown
  >;

  if (!imapHost || !imapPort || !username || !password) {
    return NextResponse.json(
      { error: "imapHost, imapPort, username, and password are required." },
      { status: 400 },
    );
  }

  const port = Number(imapPort);
  const client = new ImapFlow({
    host: String(imapHost),
    port,
    secure: port === 993,
    auth: { user: String(username), pass: String(password) },
    logger: false,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });

  try {
    await client.connect();
    await client.logout();
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
