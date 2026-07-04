import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
  withTransaction: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { withTransaction } from "@/lib/db/transaction";
import {
  approveAgentAction,
  rejectAgentAction,
} from "@/lib/actions/opportunity-actions";

const mockClient = (overrides: Record<string, unknown> = {}) => ({
  query: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("approveAgentAction", () => {
  it("throws when action belongs to a different user", async () => {
    vi.mocked(withTransaction).mockImplementationOnce(async (work) => {
      const client = mockClient({
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] }), // no action found for this user
      });
      return work(client as never);
    });

    await expect(
      approveAgentAction({ actionId: "action-1", userId: "wrong-user" }),
    ).rejects.toThrow("Action not found or unauthorized");
  });

  it("throws when action is already executed", async () => {
    vi.mocked(withTransaction).mockImplementationOnce(async (work) => {
      const client = mockClient({
        query: vi.fn()
          .mockResolvedValueOnce({
            rows: [{ id: "action-1", user_id: "user-1", status: "executed", action_type: "schedule_reminder", payload: {} }],
          }),
      });
      return work(client as never);
    });

    await expect(
      approveAgentAction({ actionId: "action-1", userId: "user-1" }),
    ).rejects.toThrow("already executed");
  });

  it("records rejection for a proposed action", async () => {
    const queryFn = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ id: "action-1", user_id: "user-1", status: "proposed", action_type: "schedule_reminder", payload: {} }],
      })
      .mockResolvedValueOnce({ rows: [] }); // update

    vi.mocked(withTransaction).mockImplementationOnce(async (work) => {
      return work(mockClient({ query: queryFn }) as never);
    });

    await rejectAgentAction({ actionId: "action-1", userId: "user-1" });

    const updateCall = queryFn.mock.calls[1];
    expect(updateCall[0]).toContain("rejected");
  });

  it("calendar and reply actions remain proposed after approval (user must click)", async () => {
    const queryFn = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ id: "action-1", user_id: "user-1", status: "proposed", action_type: "prepare_calendar_event", payload: { title: "Interview", startAt: "2026-07-09T14:00:00+10:00" } }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "action-1", status: "approved" }] }); // update

    vi.mocked(withTransaction).mockImplementationOnce(async (work) => {
      return work(mockClient({ query: queryFn }) as never);
    });

    const result = await approveAgentAction({ actionId: "action-1", userId: "user-1" });
    // Calendar action: user still needs to download/execute — returns ICS URL
    expect(result.actionUrl).toMatch(/\/api\/ics\/action\//);
  });
});
