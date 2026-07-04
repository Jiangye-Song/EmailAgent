import { describe, expect, it } from "vitest";
import { normalizeCompany, normalizeRole } from "@/lib/opportunities/normalize";
import { scoreOpportunityMatch } from "@/lib/opportunities/match";

describe("normalizeCompany", () => {
  it("strips legal suffixes and lowercases", () => {
    expect(normalizeCompany("Canva Pty Ltd.")).toBe("canva");
    expect(normalizeCompany("ACME Corp.")).toBe("acme");
    expect(normalizeCompany("Tech Inc")).toBe("tech");
  });

  it("collapses non-alphanumeric separators", () => {
    expect(normalizeCompany("Meta Platforms, Inc.")).toBe("meta platforms");
  });
});

describe("normalizeRole", () => {
  it("strips parenthetical suffixes and lowercases", () => {
    expect(normalizeRole("Graduate Software Engineer (2027)")).toBe(
      "graduate software engineer",
    );
    expect(normalizeRole("Senior Engineer (Remote)")).toBe("senior engineer");
  });

  it("collapses non-alphanumeric separators", () => {
    expect(normalizeRole("Software Engineer - Full Stack")).toBe(
      "software engineer full stack",
    );
  });
});

describe("scoreOpportunityMatch", () => {
  it("scores 1.0 for exact application reference match", () => {
    const result = scoreOpportunityMatch(
      {
        company: "Canva",
        role: "Software Engineer",
        applicationReference: "REQ-7",
      },
      {
        normalizedCompany: "canva",
        normalizedRole: "software engineer",
        applicationReference: "REQ-7",
      },
    );
    expect(result).toEqual({ score: 1, reason: "application_reference" });
  });

  it("scores 0.9 for exact normalized company+role match", () => {
    const result = scoreOpportunityMatch(
      { company: "Canva Pty Ltd.", role: "Software Engineer (Sydney)", applicationReference: null },
      { normalizedCompany: "canva", normalizedRole: "software engineer sydney", applicationReference: null },
    );
    expect(result.score).toBe(0.9);
    expect(result.reason).toBe("exact_company_role");
  });

  it("scores 0.7 for company with overlapping role tokens", () => {
    const result = scoreOpportunityMatch(
      { company: "Canva", role: "Frontend Engineer", applicationReference: null },
      { normalizedCompany: "canva", normalizedRole: "software engineer", applicationReference: null },
    );
    expect(result.score).toBe(0.7);
    expect(result.reason).toBe("company_partial_role");
  });

  it("scores 0 when no signal matches", () => {
    const result = scoreOpportunityMatch(
      { company: "Google", role: "PM", applicationReference: null },
      { normalizedCompany: "canva", normalizedRole: "engineer", applicationReference: null },
    );
    expect(result.score).toBe(0);
  });
});
