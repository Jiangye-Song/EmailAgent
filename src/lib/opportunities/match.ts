import { normalizeCompany } from "./normalize";

type ExtractionInput = {
  company: string | null;
  role: string | null;
  applicationReference: string | null;
};

type OpportunityCandidate = {
  normalizedCompany: string;
  normalizedRole: string;
  applicationReference: string | null;
};

type MatchResult = {
  score: number;
  reason: string;
};

/**
 * Normalize a role string for matching purposes: lowercase and collapse
 * non-alphanumeric separators, but retain parenthetical content as tokens
 * (e.g. "(Sydney)" → "sydney"). This differs from the exported normalizeRole
 * which strips parenthetical content entirely.
 */
function normalizeRoleForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function scoreOpportunityMatch(
  extraction: ExtractionInput,
  candidate: OpportunityCandidate,
): MatchResult {
  // Exact application reference
  if (
    extraction.applicationReference &&
    candidate.applicationReference &&
    extraction.applicationReference === candidate.applicationReference
  ) {
    return { score: 1, reason: "application_reference" };
  }

  const normCompany = normalizeCompany(extraction.company ?? "");
  const normRole = normalizeRoleForMatch(extraction.role ?? "");

  // Exact normalized company + role
  if (
    normCompany === candidate.normalizedCompany &&
    normRole === candidate.normalizedRole
  ) {
    return { score: 0.9, reason: "exact_company_role" };
  }

  // Company match + overlapping role tokens
  if (normCompany === candidate.normalizedCompany) {
    const extractionTokens = new Set(normRole.split(" ").filter(Boolean));
    const candidateTokens = candidate.normalizedRole
      .split(" ")
      .filter(Boolean);
    const overlap = candidateTokens.filter((t) => extractionTokens.has(t));
    if (overlap.length > 0) {
      return { score: 0.7, reason: "company_partial_role" };
    }
  }

  return { score: 0, reason: "no_match" };
}
