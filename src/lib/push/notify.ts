import webpush from "web-push";
import { pool } from "@/lib/db";

// Lazily initialise VAPID so missing env vars don't crash at module load time
let vapidInitialised = false;
function ensureVapid() {
  if (vapidInitialised) return;
  const subject = process.env.VAPID_SUBJECT;
  const pubKey = process.env.VAPID_PUBLIC_KEY;
  const privKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pubKey || !privKey) {
    throw new Error("VAPID env vars (VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) are not set");
  }
  webpush.setVapidDetails(subject, pubKey, privKey);
  vapidInitialised = true;
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string },
): Promise<void> {
  ensureVapid();
  const { rows } = await pool.query<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId],
  );

  await Promise.allSettled(
    rows.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      ),
    ),
  );
}
