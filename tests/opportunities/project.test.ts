import { describe, expect, it } from "vitest";
import { projectOpportunity } from "@/lib/opportunities/project";

describe("projectOpportunity", () => {
  it("projects interview stage from confirmed events", () => {
    const result = projectOpportunity([
      { eventType: "application_received", confirmed: true },
      { eventType: "interview_invited", confirmed: true },
    ]);
    expect(result).toMatchObject({ stage: "interview", outcome: "active" });
  });

  it("projects rejection as closed/rejected", () => {
    const result = projectOpportunity([
      { eventType: "application_received", confirmed: true },
      { eventType: "rejection_received", confirmed: true },
    ]);
    expect(result).toMatchObject({ stage: "closed", outcome: "rejected" });
  });

  it("projects withdrawal as closed/withdrawn", () => {
    const result = projectOpportunity([
      { eventType: "application_received", confirmed: true },
      { eventType: "application_withdrawn", confirmed: true },
    ]);
    expect(result).toMatchObject({ stage: "closed", outcome: "withdrawn" });
  });

  it("ignores unconfirmed events", () => {
    const result = projectOpportunity([
      { eventType: "application_received", confirmed: true },
      { eventType: "offer_received", confirmed: false },
    ]);
    expect(result).toMatchObject({ stage: "applied", outcome: "active" });
  });

  it("returns applied/active for empty confirmed events", () => {
    const result = projectOpportunity([]);
    expect(result).toMatchObject({ stage: "applied", outcome: "active" });
  });
});
