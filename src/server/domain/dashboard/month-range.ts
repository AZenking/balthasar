/**
 * UTC month range calculation (006-dashboard, research.md Q3).
 *
 * Returns half-open interval [start, end) for the natural month
 * containing the given date, in UTC.
 *
 * start = first day of month, 00:00:00.000 UTC
 * end   = first day of NEXT month, 00:00:00.000 UTC
 */
export function getUTCMonthRange(date: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
  );
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
  );
  return { start, end };
}
