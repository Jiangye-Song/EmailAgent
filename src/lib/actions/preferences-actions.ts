"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withTransaction } from "@/lib/db/transaction";

export const PreferencesInputSchema = z.object({
  targetRoles: z.array(z.string().trim().min(2)).min(1).max(10),
  locations: z.array(z.string().trim().min(2)).max(10),
  remotePreference: z.enum(["remote", "hybrid", "onsite", "either"]),
  targetCompanies: z.array(z.string().trim().min(2)).max(20),
  immediateAlertEvents: z.array(
    z.enum([
      "assessment_assigned",
      "interview_invited",
      "interview_changed",
      "offer_received",
      "information_requested",
    ]),
  ),
  minimumDiscountPercent: z.number().min(0).max(100),
  freeGifts: z.boolean(),
  freeformInstruction: z.string().trim().max(1000),
});

export type PreferencesInput = z.infer<typeof PreferencesInputSchema>;

export async function savePreferences(input: PreferencesInput): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const data = PreferencesInputSchema.parse(input);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO user_preferences (
        user_id, target_roles, locations, remote_preference,
        target_companies, immediate_alert_events,
        deal_preferences, freeform_instruction, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      ON CONFLICT (user_id) DO UPDATE SET
        target_roles = EXCLUDED.target_roles,
        locations = EXCLUDED.locations,
        remote_preference = EXCLUDED.remote_preference,
        target_companies = EXCLUDED.target_companies,
        immediate_alert_events = EXCLUDED.immediate_alert_events,
        deal_preferences = EXCLUDED.deal_preferences,
        freeform_instruction = EXCLUDED.freeform_instruction,
        updated_at = now()`,
      [
        userId,
        JSON.stringify(data.targetRoles),
        JSON.stringify(data.locations),
        data.remotePreference,
        JSON.stringify(data.targetCompanies),
        JSON.stringify(data.immediateAlertEvents),
        JSON.stringify({
          minimumDiscountPercent: data.minimumDiscountPercent,
          freeGifts: data.freeGifts,
        }),
        data.freeformInstruction,
      ],
    );

    await client.query(
      `UPDATE users SET onboarding_completed = true WHERE id = $1`,
      [userId],
    );
  });

  revalidatePath("/opportunities");
  redirect("/opportunities");
}
