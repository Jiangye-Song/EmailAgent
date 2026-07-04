import { pool } from "@/lib/db";

export type DealPreferences = {
  minimumDiscountPercent: number;
  freeGifts: boolean;
  targetBrands: string[];
};

export type DealInput = {
  brand: string;
  offerType: string;
  discountPercent: number | null;
  freeGift: boolean;
  expiresAt?: string | null;
};

export type SaveDealInput = DealInput & {
  userId: string;
  emailRecordId: string;
  offerValue: string | null;
  matchedRule: string;
  relevanceReason: string;
};

export function isDealRelevant(
  deal: DealInput,
  prefs: DealPreferences,
): boolean {
  // Expired deals are never relevant
  if (deal.expiresAt && new Date(deal.expiresAt) < new Date()) {
    return false;
  }

  // Free gift match
  if (deal.freeGift && prefs.freeGifts) return true;

  // Discount threshold match
  if (
    deal.discountPercent !== null &&
    deal.discountPercent >= prefs.minimumDiscountPercent
  ) {
    return true;
  }

  // Target brand match
  const normalizedBrand = deal.brand.toLowerCase().trim();
  if (
    prefs.targetBrands.some(
      (b) => b.toLowerCase().trim() === normalizedBrand,
    )
  ) {
    return true;
  }

  return false;
}

export function getDealMatchedRule(
  deal: DealInput,
  prefs: DealPreferences,
): string {
  if (deal.freeGift && prefs.freeGifts) return "free_gift";
  if (
    deal.discountPercent !== null &&
    deal.discountPercent >= prefs.minimumDiscountPercent
  ) {
    return `discount_gte_${prefs.minimumDiscountPercent}`;
  }
  const normalizedBrand = deal.brand.toLowerCase().trim();
  if (prefs.targetBrands.some((b) => b.toLowerCase().trim() === normalizedBrand)) {
    return "target_brand";
  }
  return "unknown";
}

export async function saveValuableDeal(input: SaveDealInput): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO valuable_deals
       (user_id, email_record_id, brand, offer_type, offer_value,
        expires_at, matched_rule, relevance_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (email_record_id) DO UPDATE
       SET matched_rule = EXCLUDED.matched_rule,
           relevance_reason = EXCLUDED.relevance_reason
     RETURNING id`,
    [
      input.userId,
      input.emailRecordId,
      input.brand,
      input.offerType,
      input.offerValue,
      input.expiresAt ?? null,
      input.matchedRule,
      input.relevanceReason,
    ],
  );
  return rows[0].id;
}
