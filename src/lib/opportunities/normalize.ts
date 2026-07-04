const COMPANY_SUFFIXES =
  /\b(pty|ltd|limited|inc|llc|corp|corporation)\b\.?/gi;

export function normalizeCompany(value: string): string {
  return value
    .toLowerCase()
    .replace(COMPANY_SUFFIXES, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normalizeRole(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
