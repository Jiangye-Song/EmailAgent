import { pool } from "@/lib/db";

type GoogleTokenRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null;
};

/**
 * Returns a valid Google access token for the given user.
 * Automatically refreshes the token if it is within 60 seconds of expiry.
 */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const { rows } = await pool.query<GoogleTokenRow>(
    `SELECT access_token, refresh_token, expires_at
     FROM accounts
     WHERE "userId" = $1 AND provider = 'google'
     LIMIT 1`,
    [userId],
  );

  if (!rows.length) {
    throw new Error("No Google account linked for this user.");
  }

  const { access_token, refresh_token, expires_at } = rows[0];

  // expires_at is stored as Unix epoch seconds by NextAuth
  const isExpired = expires_at
    ? Math.floor(Date.now() / 1000) > expires_at - 60
    : false;

  if (!isExpired) return access_token;

  if (!refresh_token) {
    throw new Error(
      "Access token expired and no refresh token is available. " +
        "User must sign in again.",
    );
  }

  const refreshed = await refreshGoogleToken(refresh_token);
  const newExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;

  await pool.query(
    `UPDATE accounts
     SET access_token = $1, expires_at = $2
     WHERE "userId" = $3 AND provider = 'google'`,
    [refreshed.access_token, newExpiresAt, userId],
  );

  return refreshed.access_token;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${detail}`);
  }

  return res.json();
}
