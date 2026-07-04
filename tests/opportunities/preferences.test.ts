import { describe, expect, it } from "vitest";
import { PreferencesInputSchema } from "@/lib/actions/preferences-actions";

describe("PreferencesInputSchema", () => {
  it("rejects empty target roles", () => {
    expect(() =>
      PreferencesInputSchema.parse({
        targetRoles: [],
        locations: [],
        remotePreference: "either",
        targetCompanies: [],
        immediateAlertEvents: [],
        minimumDiscountPercent: 0,
        freeGifts: false,
        freeformInstruction: "",
      }),
    ).toThrow();
  });

  it("rejects role shorter than 2 characters", () => {
    expect(() =>
      PreferencesInputSchema.parse({
        targetRoles: ["A"],
        locations: [],
        remotePreference: "either",
        targetCompanies: [],
        immediateAlertEvents: [],
        minimumDiscountPercent: 0,
        freeGifts: false,
        freeformInstruction: "",
      }),
    ).toThrow();
  });

  it("rejects invalid alert events", () => {
    expect(() =>
      PreferencesInputSchema.parse({
        targetRoles: ["Software Engineer"],
        locations: [],
        remotePreference: "either",
        targetCompanies: [],
        immediateAlertEvents: ["invalid_event"],
        minimumDiscountPercent: 0,
        freeGifts: false,
        freeformInstruction: "",
      }),
    ).toThrow();
  });

  it("accepts valid input with all allowed alert events", () => {
    const result = PreferencesInputSchema.parse({
      targetRoles: ["Software Engineer", "Frontend Developer"],
      locations: ["Sydney", "Remote"],
      remotePreference: "hybrid",
      targetCompanies: ["Canva"],
      immediateAlertEvents: ["interview_invited", "offer_received"],
      minimumDiscountPercent: 40,
      freeGifts: true,
      freeformInstruction: "Focus on startups",
    });
    expect(result.targetRoles).toHaveLength(2);
  });

  it("rejects discount percent above 100", () => {
    expect(() =>
      PreferencesInputSchema.parse({
        targetRoles: ["Engineer"],
        locations: [],
        remotePreference: "remote",
        targetCompanies: [],
        immediateAlertEvents: [],
        minimumDiscountPercent: 101,
        freeGifts: false,
        freeformInstruction: "",
      }),
    ).toThrow();
  });
});
