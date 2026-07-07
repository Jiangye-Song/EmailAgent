"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  addSenderWhitelistDomain,
  addSenderWhitelistEntry,
  removeSenderWhitelistEntry,
} from "@/lib/email/forwarding-address";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function requireUserId(): Promise<string> {
  return auth().then((session) => {
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
  });
}

export async function addWhitelistSender(input: string): Promise<void> {
  const userId = await requireUserId();
  const value = input.trim().toLowerCase();

  if (!value) throw new Error("Sender value is required");

  if (EMAIL_RE.test(value)) {
    await addSenderWhitelistEntry(userId, value);
  } else {
    const domain = value.replace(/^@/, "");
    if (!DOMAIN_RE.test(domain)) {
      throw new Error("Please enter a valid email address or domain");
    }
    await addSenderWhitelistDomain(userId, domain);
  }

  revalidatePath("/settings");
}

export async function deleteWhitelistSender(entryId: string): Promise<void> {
  const userId = await requireUserId();

  if (!entryId) throw new Error("Entry id is required");
  await removeSenderWhitelistEntry(userId, entryId);

  revalidatePath("/settings");
}

export async function setWhitelistEnabled(enabled: boolean): Promise<void> {
  const userId = await requireUserId();
  const { pool } = await import("@/lib/db");
  await pool.query(`UPDATE users SET whitelist_enabled = $1 WHERE id = $2`, [enabled, userId]);
  revalidatePath("/settings");
}
