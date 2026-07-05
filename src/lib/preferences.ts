import { z } from "zod";

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