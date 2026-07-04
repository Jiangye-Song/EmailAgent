import { describe, expect, it } from "vitest";
import {
  AgentActionSchema,
  JobEmailExtractionSchema,
} from "@/lib/opportunities/schemas";

describe("JobEmailExtractionSchema", () => {
  it("accepts a complete interview extraction", () => {
    const result = JobEmailExtractionSchema.parse({
      domain: "job",
      eventType: "interview_invited",
      company: "Canva",
      role: "Software Engineer",
      applicationReference: null,
      location: "Sydney",
      eventAt: "2026-07-08T10:00:00+10:00",
      deadlineAt: "2026-07-06T23:59:00+10:00",
      evidence: ["We would like to invite you to interview"],
      modelConfidence: 0.94,
      deal: null,
      suggestedActions: [{ type: "prepare_calendar_event", payload: {} }],
    });
    expect(result.eventType).toBe("interview_invited");
  });

  it("rejects tools outside the allowlist", () => {
    expect(() =>
      AgentActionSchema.parse({ type: "delete_all_data", payload: {} }),
    ).toThrow();
  });
});
