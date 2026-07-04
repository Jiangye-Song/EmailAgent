if (!process.env.RUN_LIVE_QWEN_EVAL) {
  console.log("Skipped: set RUN_LIVE_QWEN_EVAL=1 to run live Qwen eval");
  process.exit(0);
}

import { readFileSync } from "node:fs";
import { extractEmailIntent } from "../src/lib/agent/extract";
import type { PreferencesInput } from "../src/lib/actions/preferences-actions";

const preferences: PreferencesInput = {
  targetRoles: ["Software Engineer"],
  locations: ["Sydney", "Remote"],
  remotePreference: "hybrid",
  targetCompanies: [],
  immediateAlertEvents: ["interview_invited", "offer_received"],
  minimumDiscountPercent: 30,
  freeGifts: true,
  freeformInstruction: "",
};

const fixtures = [
  { file: "tests/fixtures/emails/application.eml", expected: "application_received" },
  { file: "tests/fixtures/emails/assessment.eml", expected: "assessment_assigned" },
  { file: "tests/fixtures/emails/interview.eml", expected: "interview_invited" },
  { file: "tests/fixtures/emails/rejection.eml", expected: "rejection_received" },
];

let hasError = false;

async function main() {
  for (const fixture of fixtures) {
    const emailText = readFileSync(fixture.file, "utf8");
    try {
      const result = await extractEmailIntent(emailText, preferences);
      const passed = result.eventType === fixture.expected;
      console.log(`${passed ? "✅" : "❌"} ${fixture.file}: expected=${fixture.expected} actual=${result.eventType} confidence=${result.modelConfidence}`);
      if (!passed) hasError = true;
    } catch (error) {
      console.error(`❌ ${fixture.file}: SCHEMA ERROR`, error);
      hasError = true;
    }
  }
}

main().catch(console.error).then(() => process.exit(hasError ? 1 : 0));
