import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { pool } from "@/lib/db";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, email, password } = body as {
    name?: string;
    email?: string;
    password?: string;
  };

  // ── Input validation ───────────────────────────────────────────────────────
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  // ── Check uniqueness ───────────────────────────────────────────────────────
  const existing = await pool.query(
    `SELECT id FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  // ── Create user ────────────────────────────────────────────────────────────
  const passwordHash = await hash(password, 12);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [name?.trim() || null, email.toLowerCase(), passwordHash],
  );

  const userId = rows[0].id;

  // Generate forwarding address immediately so it's ready on first login
  await ensureForwardingAddress(userId);

  return NextResponse.json({ ok: true }, { status: 201 });
}
