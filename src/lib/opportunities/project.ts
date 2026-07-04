import type { OpportunityStage } from "./schemas";

const STAGE_BY_EVENT: Record<string, OpportunityStage> = {
  application_received: "applied",
  assessment_assigned: "assessment",
  assessment_deadline_changed: "assessment",
  interview_invited: "interview",
  interview_scheduled: "interview",
  interview_changed: "interview",
  offer_received: "offer",
  rejection_received: "closed",
  application_withdrawn: "closed",
};

type EventInput = {
  eventType: string;
  confirmed: boolean;
  deadlineAt?: string | null;
};

type ProjectionResult = {
  stage: OpportunityStage;
  outcome: string;
  nextDeadline: string | null;
};

export function projectOpportunity(events: EventInput[]): ProjectionResult {
  let stage: OpportunityStage = "applied";
  let outcome = "active";
  let nextDeadline: string | null = null;

  for (const event of events) {
    if (!event.confirmed) continue;
    const mappedStage = STAGE_BY_EVENT[event.eventType];
    if (mappedStage) {
      stage = mappedStage;
    }
    if (event.eventType === "rejection_received") {
      outcome = "rejected";
    } else if (event.eventType === "application_withdrawn") {
      outcome = "withdrawn";
    }
    if (event.deadlineAt && (!nextDeadline || event.deadlineAt < nextDeadline)) {
      nextDeadline = event.deadlineAt;
    }
  }

  return { stage, outcome, nextDeadline };
}
