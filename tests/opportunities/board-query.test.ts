import { describe, expect, it, vi } from "vitest";
import { getOpportunityBoard } from "@/lib/opportunities/board-query";

vi.mock("@/lib/db", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from "@/lib/db";

describe("getOpportunityBoard", () => {
  it("groups opportunities by stage", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: "opp-1",
          company: "Canva",
          role: "Software Engineer",
          stage: "interview",
          outcome: "active",
          latest_change: "Interview invited",
          next_action: "Confirm availability",
          next_deadline: "2026-07-09T14:00:00+10:00",
          confidence: 0.94,
          evidence: ["We would like to invite you to interview"],
        },
        {
          id: "opp-2",
          company: "Atlassian",
          role: "Frontend Engineer",
          stage: "applied",
          outcome: "active",
          latest_change: "Application received",
          next_action: null,
          next_deadline: null,
          confidence: 0.85,
          evidence: ["Thank you for applying"],
        },
      ],
    } as never);

    const result = await getOpportunityBoard("user-1");

    expect(result.byStage.interview).toHaveLength(1);
    expect(result.byStage.applied).toHaveLength(1);
    expect(result.byStage.interview[0].company).toBe("Canva");
  });

  it("puts overdue items in urgent", async () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString();
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: "opp-3",
          company: "Stripe",
          role: "Engineer",
          stage: "assessment",
          outcome: "active",
          latest_change: "Assessment assigned",
          next_action: "Complete assessment",
          next_deadline: pastDeadline,
          confidence: 0.9,
          evidence: ["Complete by tomorrow"],
        },
      ],
    } as never);

    const result = await getOpportunityBoard("user-1");
    expect(result.urgent).toHaveLength(1);
  });

  it("never returns another user's records", async () => {
    vi.mocked(pool.query).mockImplementationOnce(async (_sql, params) => {
      const userId = (params as string[])[0];
      expect(userId).toBe("user-1");
      return { rows: [] };
    });

    await getOpportunityBoard("user-1");
    // Test asserts the query is called with user-1 as the parameter
  });
});
