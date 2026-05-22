// ── Date utilities (calendar-only, TZ-safe) ──────────────────────────────────
// All date math in Centsible is calendar-based, not timestamp-based. Goals,
// budgets, and forecasts deal in YYYY-MM-DD strings. Going through Date
// objects introduces the viewer's local timezone, which can shift the
// year/month by one near midnight UTC. These helpers keep everything in
// integer (year, month, day) space.

export type YearMonth = { year: number; month: number };

export type YearMonthDay = YearMonth & { day: number };

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a YYYY-MM-DD string. Returns null on shape mismatch. */
export function parseYmd(value: string): YearMonthDay | null {
  const m = YMD_RE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

/** Today's calendar year/month, evaluated in UTC. Stable across timezones. */
export function utcTodayYearMonth(now: Date = new Date()): YearMonth {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/**
 * Whole months from `from` (inclusive) to `to` (exclusive) in calendar terms.
 * Negative when `from` is later than `to`. The day component is ignored.
 */
export function monthsBetween(from: YearMonth, to: YearMonth): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/** Add `delta` months to a year/month pair. Negative delta moves backwards. */
export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const totalMonthsZero = ym.year * 12 + (ym.month - 1) + delta;
  const year = Math.floor(totalMonthsZero / 12);
  const month = (totalMonthsZero % 12 + 12) % 12 + 1;
  return { year, month };
}

/** "2026-05" form. */
export function formatYearMonth({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** First day of `ym` as a YYYY-MM-DD string. */
export function firstOfMonth({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
