"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { encrypt } from "@/lib/credentials";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CredentialInput = {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
};

export type CredentialMeta = {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
};

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Save (or overwrite) IMAP/SMTP credentials for the current user. */
export async function saveCredentials(input: CredentialInput): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const secretEnc = encrypt(input.password);

  await pool.query(
    `INSERT INTO email_credentials
       (user_id, imap_host, imap_port, smtp_host, smtp_port, username, secret_enc)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       imap_host  = EXCLUDED.imap_host,
       imap_port  = EXCLUDED.imap_port,
       smtp_host  = EXCLUDED.smtp_host,
       smtp_port  = EXCLUDED.smtp_port,
       username   = EXCLUDED.username,
       secret_enc = EXCLUDED.secret_enc,
       updated_at = now()`,
    [
      session.user.id,
      input.imapHost,
      input.imapPort,
      input.smtpHost,
      input.smtpPort,
      input.username,
      secretEnc,
    ],
  );

  revalidatePath("/settings");
}

/** Return non-secret credential info for display in the Settings UI. */
export async function getCredentialMeta(): Promise<CredentialMeta | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { rows } = await pool.query<{
    imap_host: string;
    imap_port: number;
    smtp_host: string;
    smtp_port: number;
    username: string;
  }>(
    `SELECT imap_host, imap_port, smtp_host, smtp_port, username
     FROM email_credentials
     WHERE user_id = $1
     LIMIT 1`,
    [session.user.id],
  );

  if (!rows.length) return null;
  const r = rows[0];
  return {
    imapHost: r.imap_host,
    imapPort: r.imap_port,
    smtpHost: r.smtp_host,
    smtpPort: r.smtp_port,
    username: r.username,
  };
}

/** Remove saved credentials for the current user. */
export async function deleteCredentials(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await pool.query(
    `DELETE FROM email_credentials WHERE user_id = $1`,
    [session.user.id],
  );

  revalidatePath("/settings");
}
