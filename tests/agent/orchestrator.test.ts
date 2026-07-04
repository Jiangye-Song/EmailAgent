import { describe, expect, it, vi, beforeEach } from "vitest";
import type { JobEmailExtraction } from "@/lib/opportunities/schemas";
import { compositeConfidence } from "@/lib/agent/orchestrator";

// We test compositeConfidence in isolation (pure function, no DB)
describe("compositeConfidence", () => {
  it("returns high confidence for complete job evidence", () => {
    const score = compositeConfidence({
      model: 0.95,
      evidenceCount: 3,
      exactReference: true,
      exactCompanyRole: true,
      hasEventType: true,
    });
    expect(score).toBeGreaterThanOrEqual(0.85);
  });

  it("returns medium confidence for partial evidence", () => {
    const score = compositeConfidence({
      model: 0.75,
      evidenceCount: 1,
      exactReference: false,
      exactCompanyRole: false,
      hasEventType: true,
    });
    expect(score).toBeGreaterThanOrEqual(0.6);
    expect(score).toBeLessThan(0.85);
  });

  it("returns low confidence with weak model and no evidence", () => {
    const score = compositeConfidence({
      model: 0.4,
      evidenceCount: 0,
      exactReference: false,
      exactCompanyRole: false,
      hasEventType: false,
    });
    expect(score).toBeLessThan(0.6);
  });

  it("uses the exact formula from the spec", () => {
    const score = compositeConfidence({
      model: 0.8,
      evidenceCount: 2,
      exactReference: false,
      exactCompanyRole: true,
      hasEventType: true,
    });
    // model*0.5 + min(evidenceCount/2,1)*0.15 + identity*0.25 + event*0.1
    // 0.8*0.5 + 1.0*0.15 + 0.9*0.25 + 1.0*0.1 = 0.4 + 0.15 + 0.225 + 0.1 = 0.875
    expect(score).toBe(0.875);
  });
});

// Tool allowlist tests
import { validateToolCall } from "@/lib/agent/tools";

describe("validateToolCall", () => {
  it("accepts an allowlisted tool", () => {
    expect(() =>
      validateToolCall({ type: "request_human_review", payload: { reason: "ambiguous" } }),
    ).not.toThrow();
  });

  it("rejects an unallowlisted tool", () => {
    expect(() =>
      validateToolCall({ type: "delete_all_data" as never, payload: {} }),
    ).toThrow();
  });

  it("rejects prepare_calendar_event without required fields", () => {
    expect(() =>
      validateToolCall({ type: "prepare_calendar_event", payload: {} }),
    ).toThrow();
  });
});
