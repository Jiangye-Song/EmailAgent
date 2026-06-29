import { pool } from "@/lib/db";

const EMAIL_IN_TEXT_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function extractEmailAddress(value: string): string | null {
  const match = value.match(EMAIL_IN_TEXT_RE);
  if (!match) return null;
  return normalizeAddress(match[0]);
}

function extractDomain(value: string): string | null {
  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) return null;
  return value.slice(atIndex + 1);
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

/**
 * Returns the user's forwarding address, generating and persisting one if absent.
 * Safe to call on every page render — idempotent.
 */
export async function ensureForwardingAddress(userId: string): Promise<string> {
  const existing = await pool.query<{ forwarding_address: string | null }>(
    `SELECT forwarding_address FROM users WHERE id = $1`,
    [userId],
  );

  if (existing.rows[0]?.forwarding_address) {
    return existing.rows[0].forwarding_address;
  }

  const domain = process.env.INBOUND_DOMAIN;
  if (!domain) throw new Error("INBOUND_DOMAIN env var is not set");

  // First 8 hex chars of the UUID (without dashes) as the address prefix
  const prefix = userId.replace(/-/g, "").slice(0, 8);
  const address = `${prefix}@${domain}`;

  await pool.query(
    `UPDATE users SET forwarding_address = $1 WHERE id = $2`,
    [address, userId],
  );

  return address;
}

export async function getUserByForwardingAddress(address: string): Promise<{ id: string } | null> {
  const extracted = extractEmailAddress(address);
  const normalized = normalizeAddress(address);
  const candidates = Array.from(
    new Set([...(extracted ? [extracted] : []), normalized]),
  );

  if (candidates.length === 0) return null;

  const { rows } = await pool.query<{ id: string }>(
    `SELECT id
     FROM users
     WHERE forwarding_address = ANY($1::text[])
     LIMIT 1`,
    [candidates],
  );

  return rows[0] ?? null;
}

export async function addSenderWhitelistEntry(
  userId: string,
  senderEmail: string,
): Promise<void> {
  const normalizedEmail = normalizeAddress(senderEmail);
  const senderDomain = extractDomain(normalizedEmail);

  await pool.query(
    `INSERT INTO sender_whitelist (user_id, sender_email, sender_domain)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, sender_email) DO NOTHING`,
    [userId, normalizedEmail, senderDomain],
  );
}

export async function addSenderWhitelistDomain(
  userId: string,
  senderDomainRaw: string,
): Promise<void> {
  const senderDomain = normalizeDomain(senderDomainRaw);
  const syntheticEmail = `*@${senderDomain}`;

  await pool.query(
    `INSERT INTO sender_whitelist (user_id, sender_email, sender_domain)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, sender_email) DO NOTHING`,
    [userId, syntheticEmail, senderDomain],
  );
}

export async function removeSenderWhitelistEntry(
  userId: string,
  entryId: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM sender_whitelist WHERE id = $1 AND user_id = $2`,
    [entryId, userId],
  );
}

export async function isSenderWhitelisted(
  userId: string,
  senderRaw: string,
): Promise<boolean> {
  const senderEmail = extractEmailAddress(senderRaw);
  if (!senderEmail) return false;

  const senderDomain = extractDomain(senderEmail);

  const { rows } = await pool.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM sender_whitelist
       WHERE user_id = $1
         AND (
           sender_email = $2
           OR sender_domain = $3::text
         )
     ) AS allowed`,
    [userId, senderEmail, senderDomain],
  );

  return rows[0]?.allowed ?? false;
}
