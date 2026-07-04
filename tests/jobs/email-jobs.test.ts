import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the DB module
vi.mock("@/lib/db", () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock("@/lib/db/transaction", () => ({
  withTransaction: vi.fn(),
}));

import { withTransaction } from "@/lib/db/transaction";
import {
  enqueueInboundEmail,
  claimJobs,
  completeJob,
  failJob,
  LEASE_DURATION_MS,
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
} from "@/lib/jobs/email-jobs";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enqueueInboundEmail", () => {
  it("returns existing email record when content hash matches", async () => {
    vi.mocked(withTransaction).mockImplementationOnce(async (work) => {
      return work({
        query: vi.fn().mockResolvedValueOnce({
          // Simulates: SELECT id FROM email_records WHERE user_id=$1 AND content_hash=$2
          rows: [{ id: "existing-id" }],
        }),
      } as never);
    });

    const result = await enqueueInboundEmail({
      userId: "user-1",
      messageId: "msg-1",
      subject: "Test",
      sender: "test@example.com",
      receivedAt: new Date(),
      contentHash: "hash-abc",
      rawMime: Buffer.from("raw"),
      parsedBody: "body",
    });

    expect(result).toEqual({ emailRecordId: "existing-id", isDuplicate: true });
  });

  it("creates email record and job when content hash is new", async () => {
    vi.mocked(withTransaction).mockImplementationOnce(async (work) => {
      return work({
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] }) // no duplicate
          .mockResolvedValueOnce({ rows: [{ id: "new-email-id" }] }) // insert email
          .mockResolvedValueOnce({ rows: [] }), // insert job
      } as never);
    });

    const result = await enqueueInboundEmail({
      userId: "user-1",
      messageId: "msg-2",
      subject: "New email",
      sender: "a@example.com",
      receivedAt: new Date(),
      contentHash: "hash-new",
      rawMime: Buffer.from("raw"),
      parsedBody: "body",
    });

    expect(result).toEqual({ emailRecordId: "new-email-id", isDuplicate: false });
  });
});

describe("constants", () => {
  it("defines lease duration", () => {
    expect(LEASE_DURATION_MS).toBe(5 * 60 * 1000); // 5 minutes
  });

  it("defines max attempts", () => {
    expect(MAX_ATTEMPTS).toBe(4); // 3 retries + 1 = 4
  });

  it("defines retry delays for 3 retry tiers", () => {
    expect(RETRY_DELAYS_MS).toHaveLength(3);
    expect(RETRY_DELAYS_MS[0]).toBe(1 * 60 * 1000);  // 1 minute
    expect(RETRY_DELAYS_MS[1]).toBe(5 * 60 * 1000);  // 5 minutes
    expect(RETRY_DELAYS_MS[2]).toBe(15 * 60 * 1000); // 15 minutes
  });
});
