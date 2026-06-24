import { pool } from "@/lib/db";

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
