const TAG_SANITIZE_REGEX = /[^A-Z0-9]/g;
const TAG_PREFIX = "#";

export function normalizeClanTag(input: string): string {
  const upper = input.trim().toUpperCase().replace(TAG_SANITIZE_REGEX, "");
  return `${TAG_PREFIX}${upper}`;
}

export function encodeClanTagForPath(tag: string): string {
  return encodeURIComponent(normalizeClanTag(tag));
}

export function isValidClanTag(tag: string): boolean {
  return /^#[A-Z0-9]{3,}$/.test(normalizeClanTag(tag));
}
