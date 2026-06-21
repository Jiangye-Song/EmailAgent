import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { pool } from "@/lib/db";

const ALGORITHM = "aes-256-gcm" as const;
const KEY_ENV = "CREDENTIAL_ENCRYPTION_KEY";

// ─── Key helper ───────────────────────────────────────────────────────────────

function getKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex || hex.length !== 64) {
    throw new Error(
      `${KEY_ENV} must be a 64-character hex string (32 bytes). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return Buffer.from(hex, "hex");
}

// ─── Encrypt / decrypt ────────────────────────────────────────────────────────

/** Returns `<iv_hex>:<tag_hex>:<ciphertext_hex>` */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(
    ":",
  );
}

/** Decrypts a string produced by `encrypt()`. */
export function decrypt(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted credential format.");
  const [ivHex, tagHex, cipherHex] = parts;
  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImapCredentials = {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  /** Decrypted app password — never persisted in plaintext */
  password: string;
};

// ─── DB helper ────────────────────────────────────────────────────────────────

/** Load and decrypt IMAP credentials for a user. Throws if none configured. */
export async function getCredentials(userId: string): Promise<ImapCredentials> {
  const { rows } = await pool.query<{
    imap_host: string;
    imap_port: number;
    smtp_host: string;
    smtp_port: number;
    username: string;
    secret_enc: string;
  }>(
    `SELECT imap_host, imap_port, smtp_host, smtp_port, username, secret_enc
     FROM email_credentials
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  if (!rows.length) {
    throw new Error(
      "No IMAP credentials configured for this user. " +
        "Add them in Settings → Email Account.",
    );
  }

  const r = rows[0];
  return {
    imapHost: r.imap_host,
    imapPort: r.imap_port,
    smtpHost: r.smtp_host,
    smtpPort: r.smtp_port,
    username: r.username,
    password: decrypt(r.secret_enc),
  };
}
