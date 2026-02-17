const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

export function getSeasonKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getSeasonDisplayName(date: Date): string {
  const month = MONTH_LABELS[date.getUTCMonth()] ?? "CWL";
  const year = date.getUTCFullYear();
  return `${month} ${year} CWL`;
}

export function dateDaysAgo(days: number): Date {
  const now = Date.now();
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

export function parseUtcDateOrNow(value?: string): Date {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}
