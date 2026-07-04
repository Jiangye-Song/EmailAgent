import { describe, expect, it } from "vitest";
import { isDealRelevant, type DealInput, type DealPreferences } from "@/lib/agent/deals";

describe("isDealRelevant", () => {
  const basePrefs: DealPreferences = {
    minimumDiscountPercent: 40,
    freeGifts: true,
    targetBrands: [],
  };

  it("does not save a generic 10% discount below threshold", () => {
    const deal: DealInput = {
      brand: "Random Store",
      offerType: "discount",
      discountPercent: 10,
      freeGift: false,
    };
    expect(isDealRelevant(deal, basePrefs)).toBe(false);
  });

  it("saves a 50% discount above the 40% threshold", () => {
    const deal: DealInput = {
      brand: "Big Store",
      offerType: "discount",
      discountPercent: 50,
      freeGift: false,
    };
    expect(isDealRelevant(deal, basePrefs)).toBe(true);
  });

  it("saves a free member gift when freeGifts is enabled", () => {
    const deal: DealInput = {
      brand: "Membership Brand",
      offerType: "free_gift",
      discountPercent: null,
      freeGift: true,
    };
    expect(isDealRelevant(deal, basePrefs)).toBe(true);
  });

  it("does not alert about an expired coupon even if valuable", () => {
    const deal: DealInput = {
      brand: "Big Store",
      offerType: "discount",
      discountPercent: 80,
      freeGift: false,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    // Expired deals should not be considered relevant
    expect(isDealRelevant(deal, basePrefs)).toBe(false);
  });
});
