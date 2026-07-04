import { z } from "zod";
import { AgentActionSchema, type AgentAction } from "@/lib/opportunities/schemas";

// Tool-specific payload schemas
const CalendarEventPayloadSchema = z.object({
  title: z.string().min(1),
  startAt: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
  description: z.string().optional(),
});

const ReminderPayloadSchema = z.object({
  reminderAt: z.string().min(1),
  message: z.string().min(1),
});

const ReplyPayloadSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

const HumanReviewPayloadSchema = z.object({
  reason: z.string().min(1),
});

const TOOL_PAYLOAD_SCHEMAS: Partial<Record<AgentAction["type"], z.ZodTypeAny>> = {
  prepare_calendar_event: CalendarEventPayloadSchema,
  schedule_reminder: ReminderPayloadSchema,
  prepare_reply: ReplyPayloadSchema,
  request_human_review: HumanReviewPayloadSchema,
};

export function validateToolCall(action: AgentAction): void {
  // First validate the action type is in the allowlist
  AgentActionSchema.parse(action);

  // Then validate the payload against the tool-specific schema (if one exists)
  const payloadSchema = TOOL_PAYLOAD_SCHEMAS[action.type];
  if (payloadSchema) {
    payloadSchema.parse(action.payload);
  }
}

export function isRequiresApproval(actionType: AgentAction["type"]): boolean {
  // These actions always require user approval regardless of confidence
  const ALWAYS_APPROVE = new Set([
    "prepare_reply",
    "prepare_calendar_event",
    "propose_stage_update",
  ]);
  return ALWAYS_APPROVE.has(actionType);
}
