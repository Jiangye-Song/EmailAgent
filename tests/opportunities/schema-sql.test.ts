import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("scripts/db/schema.sql", "utf8");

describe("opportunity schema", () => {
  for (const table of [
    "user_preferences", "opportunities", "opportunity_events",
    "agent_actions", "email_processing_jobs", "valuable_deals",
  ]) {
    it(`defines ${table}`, () => {
      expect(sql).toMatch(new RegExp(`create table if not exists ${table}`));
    });
  }
  it("adds idempotent processing fields", () => {
    expect(sql).toContain("processing_status");
    expect(sql).toContain("content_hash");
  });
});
