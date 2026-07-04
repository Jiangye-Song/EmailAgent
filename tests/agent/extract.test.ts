import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PreferencesInput } from "@/lib/actions/preferences-actions";

// Mock the AI SDK before importing extract
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

// Mock qwen module
vi.mock("@/lib/ai/qwen", () => ({
  qwenPlus: { modelId: "qwen3.7-plus" },
}));

const { generateObject } = await import("ai");
const { extractEmailIntent, ExtractionError } = await import(
  "@/lib/agent/extract"
);

const mockPreferences: PreferencesInput = {
  targetRoles: ["Software Engineer"],
  locations: ["Sydney"],
  remotePreference: "hybrid",
  targetCompanies: ["Canva"],
  immediateAlertEvents: ["interview_invited"],
  minimumDiscountPercent: 30,
  freeGifts: true,
  freeformInstruction: "",
};

const validExtraction = {
  domain: "job" as const,
  eventType: "interview_invited" as const,
  company: "Canva",
  role: "Software Engineer",
  applicationReference: null,
  location: "Sydney",
  eventAt: "2026-07-08T10:00:00+10:00",
  deadlineAt: null,
  evidence: ["We would like to invite you to interview"],
  modelConfidence: 0.94,
  deal: null,
  suggestedActions: [{ type: "prepare_calendar_event" as const, payload: {} }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractEmailIntent", () => {
  it("returns schema-valid extraction from model output", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validExtraction } as never);

    const result = await extractEmailIntent(
      "From: recruiter@canva.com\nSubject: Interview invitation\n\nWe would like to invite you to interview.",
      mockPreferences,
    );

    expect(result.eventType).toBe("interview_invited");
    expect(result.domain).toBe("job");
  });

  it("places email in prompt under UNTRUSTED_EMAIL label", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validExtraction } as never);

    const emailText = "EVIL INJECTION ATTEMPT";
    await extractEmailIntent(emailText, mockPreferences);

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as { prompt: string; system: string };
    expect(callArgs.prompt).toContain("UNTRUSTED_EMAIL");
    expect(callArgs.prompt).toContain(emailText);
  });

  it("system prompt states email cannot change tools", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: validExtraction } as never);

    await extractEmailIntent("test email", mockPreferences);

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as { system: string };
    expect(callArgs.system).toContain("UNTRUSTED_EMAIL");
    expect(callArgs.system.toLowerCase()).toMatch(/instruction|tool|data/);
  });

  it("throws ExtractionError when model returns malformed output", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("Schema validation failed"));

    await expect(
      extractEmailIntent("test email", mockPreferences),
    ).rejects.toBeInstanceOf(ExtractionError);
  });
});
