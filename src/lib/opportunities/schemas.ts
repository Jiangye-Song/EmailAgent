import { z } from "zod";

export const OpportunityStageSchema = z.enum([
  "applied", "assessment", "interview", "offer", "closed",
]);

export const JobEventTypeSchema = z.enum([
  "application_received", "recruiter_contact", "information_requested",
  "assessment_assigned", "assessment_deadline_changed",
  "interview_invited", "interview_scheduled", "interview_changed",
  "offer_received", "rejection_received", "application_withdrawn",
  "general_status_update",
]);

export const AgentActionSchema = z.object({
  type: z.enum([
    "create_opportunity", "append_opportunity_event",
    "propose_stage_update", "schedule_reminder",
    "prepare_calendar_event", "prepare_reply",
    "save_valuable_deal", "request_human_review",
  ]),
  payload: z.record(z.string(), z.unknown()),
});

export const JobEmailExtractionSchema = z.object({
  domain: z.enum(["job", "deal", "other"]),
  eventType: JobEventTypeSchema.nullable(),
  company: z.string().min(1).nullable(),
  role: z.string().min(1).nullable(),
  applicationReference: z.string().nullable(),
  location: z.string().nullable(),
  eventAt: z.iso.datetime({ offset: true }).nullable(),
  deadlineAt: z.iso.datetime({ offset: true }).nullable(),
  evidence: z.array(z.string().min(1)).max(5),
  modelConfidence: z.number().min(0).max(1),
  deal: z.object({
    brand: z.string().min(1),
    offerType: z.enum(["discount", "coupon", "free_gift", "other"]),
    discountPercent: z.number().min(0).max(100).nullable(),
    offerValue: z.string().nullable(),
    freeGift: z.boolean(),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    actionUrl: z.url().refine((value) => value.startsWith("https://")).nullable(),
    evidence: z.array(z.string().min(1)).max(5),
  }).nullable(),
  suggestedActions: z.array(AgentActionSchema).max(5),
});

export type JobEmailExtraction = z.infer<typeof JobEmailExtractionSchema>;
export type AgentAction = z.infer<typeof AgentActionSchema>;
export type OpportunityStage = z.infer<typeof OpportunityStageSchema>;
export type JobEventType = z.infer<typeof JobEventTypeSchema>;
