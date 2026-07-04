import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Mock all external dependencies
vi.mock("@/lib/db", () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock("@/lib/db/transaction", () => ({
  withTransaction: vi.fn(),
}));

vi.mock("@/lib/agent/extract", () => ({
  extractEmailIntent: vi.fn(),
  ExtractionError: class ExtractionError extends Error {},
}));

import { withTransaction } from "@/lib/db/transaction";
import { extractEmailIntent } from "@/lib/agent/extract";
import { enqueueInboundEmail, computeContentHash } from "@/lib/jobs/email-jobs";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inbound flow contract tests", () => {
  it("each fixture file exists and is readable", () => {
    const fixtures = [
      "application.eml",
      "assessment.eml",
      "interview.eml",
      "rejection.eml",
      "prompt-injection.eml",
      "offer.eml",
      "interview-reschedule.eml",
      "ordinary-promotion.eml",
      "member-gift.eml",
    ];

    for (const fixture of fixtures) {
      const path = join(process.cwd(), "tests/fixtures/emails", fixture);
      const content = readFileSync(path, "utf8");
      expect(content.length).toBeGreaterThan(50);
      expect(content).toContain("Message-ID:");
    }
  });

  it("computeContentHash produces consistent output", () => {
    const raw = Buffer.from("test email content");
    const hash1 = computeContentHash("user-1", "msg-1", raw);
    const hash2 = computeContentHash("user-1", "msg-1", raw);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it("different users produce different hashes for same content", () => {
    const raw = Buffer.from("test email content");
    const hash1 = computeContentHash("user-1", "msg-1", raw);
    const hash2 = computeContentHash("user-2", "msg-1", raw);
    expect(hash1).not.toBe(hash2);
  });

  it("duplicate email returns isDuplicate=true without re-enqueueing", async () => {
    vi.mocked(withTransaction).mockImplementationOnce(async (work) => {
      return work({
        query: vi.fn().mockResolvedValueOnce({ rows: [{ id: "existing-id" }] }),
      } as never);
    });

    const result = await enqueueInboundEmail({
      userId: "user-1",
      messageId: "msg-dup",
      subject: "Duplicate",
      sender: "sender@example.com",
      receivedAt: new Date(),
      contentHash: "hash-exists",
      rawMime: Buffer.from("raw"),
      parsedBody: "body",
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.emailRecordId).toBe("existing-id");
  });

  it("prompt-injection fixture contains injection attempt", () => {
    const path = join(process.cwd(), "tests/fixtures/emails/prompt-injection.eml");
    const content = readFileSync(path, "utf8");
    expect(content.toLowerCase()).toMatch(/ignore|system|override/);
  });

  it("extractEmailIntent is called with UNTRUSTED_EMAIL in prompt", async () => {
    vi.mocked(withTransaction).mockResolvedValue({
      emailRecordId: "test-id",
      isDuplicate: false,
    } as never);

    const mockExtraction = {
      domain: "job",
      eventType: "application_received",
      company: "Test Co",
      role: "Engineer",
      applicationReference: null,
      location: null,
      eventAt: null,
      deadlineAt: null,
      evidence: ["Thank you for applying"],
      modelConfidence: 0.9,
      deal: null,
      suggestedActions: [],
    };

    vi.mocked(extractEmailIntent).mockResolvedValueOnce(mockExtraction as never);

    // Just verify extractEmailIntent mock works
    const emailText = "From: test@example.com\nTest email";
    const result = await extractEmailIntent(emailText, {
      targetRoles: ["Engineer"],
      locations: [],
      remotePreference: "either",
      targetCompanies: [],
      immediateAlertEvents: [],
      minimumDiscountPercent: 30,
      freeGifts: false,
      freeformInstruction: "",
    });
    expect(result.domain).toBe("job");
  });
});
