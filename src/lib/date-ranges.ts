/**
 * Date range utilities for 026-cream-amber-revamp (R7).
 *
 * Pure UTC date math — no IO, no side effects, no third-party deps
 * (`date-fns` / `dayjs` rejected as YAGNI, see research.md R7).
 *
 * Conventions:
 * - All boundaries use `Date.UTC(...)`. Getters used: `getUTCFullYear` /
 *   `getUTCMonth` / `getUTCDate` / `getUTCDay`.
 * - `end` is always exclusive (next boundary at 00:00:00 UTC).
 * - Week starts Monday: JS `getUTCDay()` returns 0=Sun, 1=Mon, ..., 6=Sat;
 *   we map to ISO-style weekday (0=Mon, ..., 6=Sun) via `(d === 0 ? 6 : d - 1)`.
 * - `amount` semantics are caller's responsibility. In DB `amount` is signed
 *   (income +, expense −). These helpers aggregate per-day without sign
 *   conversion — the caller decides how to project income/expense.
 *
 * Consumed by `dashboard.summary` / `dashboard.report` procedures and the
 * 24-month Select on the home page.
 */

/**
 * Map JS `getUTCDay()` (Sun=0..Sat=6) to ISO weekday (Mon=0..Sun=6).
 */
function isoWeekday(utcDay: number): number {
  return utcDay === 0 ? 6 : utcDay - 1;
}

/**
 * Get the UTC [start, end) range of the Mon..Sun week containing `now`
 * (030-home-trend-area-today R5).
 *
 * - `start` = Monday on or before `now`'s UTC day, 00:00:00 UTC.
 * - `end`   = the following Monday, 00:00:00 UTC (exclusive) — span = 7 days.
 *
 * Mirrors the Monday-anchor logic of `getUtcWeeksInMonth` (ISO weekday map
 * + dayMs subtraction), but anchors on `now` instead of `monthStart`. The
 * time-of-day of `now` is normalized away: `start` is always Monday 00:00 UTC
 * regardless of when in the week `now` falls.
 *
 * Used by `dashboard.summary` to compute the fixed "current week" trend
 * window (7 daily buckets Mon..Sun), which is independent of the selected
 * year/month input (spec 030 Clarification Q2). The exclusive `end` matches
 * `getUtcMonthRange`'s contract so it slots directly into `getDailyTrend`'s
 * `weekStart`/`weekEnd` parameters.
 *
 * `now` defaults to `new Date()`; tests pass an explicit value.
 */
export function getCurrentUtcWeekRange(
  now: Date = new Date(),
): { start: Date; end: Date } {
  const dayMs = 24 * 60 * 60 * 1000;
  const startDow = isoWeekday(now.getUTCDay()); // 0=Mon..6=Sun
  // Normalize to 00:00:00 UTC of today, then subtract whole days back to Monday.
  const todayMidnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const start = new Date(todayMidnightUtc - startDow * dayMs);
  const end = new Date(start.getTime() + 7 * dayMs);
  return { start, end };
}

/**
 * Format a Date as 'YYYY-MM-DD' (UTC). Used as bucket keys by
 * `padDailyBuckets` and in test assertions.
 */
function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Get the UTC [start, end) range for a given (year, month).
 *
 * `start` = first day of month, 00:00:00 UTC.
 * `end`   = first day of next month, 00:00:00 UTC (exclusive).
 *
 * JS `Date.UTC` normalizes overflow: `Date.UTC(2026, 12, 1)` → 2027-01-01,
 * so we never need to special-case December.
 */
export function getUtcMonthRange(
  year: number,
  month: number,
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

/**
 * Get the list of Mon-Sun weeks that cover the given (year, month).
 *
 * - The first week starts on the Monday on or before day 1 of the month
 *   (may land in the previous month).
 * - The last week ends on the Monday on or after the last day of the month
 *   (may land in the next month).
 * - Partial weeks at the boundaries still count (FR-C004).
 *
 * Each entry: `{ start: Mon 00:00 UTC, end: next Mon 00:00 UTC (excl), label }`.
 *
 * `label`:
 * - `'M/D-D'` when start-day and end-day differ (e.g. `'6/29-7/5'`,
 *   `'6/1-6/7'`). This is the normal case — every Mon-Sun week spans 7 days.
 * - `'M/D'` (single token) when start and end land on the same calendar
 *   date. Defensive branch: a true 7-day Mon-Sun week never triggers it,
 *   but we keep the branch so the label function is total and won't throw
 *   on degenerate input.
 *
 * Label examples (from spec + tests):
 * - Week 2026-06-29..2026-07-05 → `'6/29-7/5'`
 * - Week 2026-06-01..2026-06-07 → `'6/1-6/7'`
 */
export function getUtcWeeksInMonth(
  year: number,
  month: number,
): Array<{ start: Date; end: Date; label: string }> {
  const { start: monthStart, end: monthEnd } = getUtcMonthRange(year, month);

  // Monday on or before monthStart (ISO weekday 0..6; subtract to land on Mon).
  const startDow = isoWeekday(monthStart.getUTCDay());
  const firstWeekStartMs = monthStart.getTime() - startDow * 24 * 60 * 60 * 1000;
  const firstWeekStart = new Date(firstWeekStartMs);

  // Walk Mon → next Mon until we pass monthEnd (exclusive).
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  const weeks: Array<{ start: Date; end: Date; label: string }> = [];
  for (
    let ws = firstWeekStart;
    ws.getTime() < monthEnd.getTime();
    ws = new Date(ws.getTime() + weekMs)
  ) {
    const we = new Date(ws.getTime() + weekMs); // next Mon 00:00 UTC (excl)
    // `end` is exclusive (next Mon 00:00). For the human-readable label we
    // want the INCLUSIVE last day (Sunday). Subtract 1 day from `we` to get
    // Sunday's calendar date — but via Date math (not integer -1) so we cross
    // month/year boundaries correctly (e.g. we=2026-08-03 → Sun=2026-08-02;
    // we=2026-03-01 → Sun=2026-02-28).
    const sun = new Date(we.getTime() - dayMs);
    const wsMon = ws.getUTCMonth() + 1;
    const wsDay = ws.getUTCDate();
    const sunMon = sun.getUTCMonth() + 1;
    const sunDay = sun.getUTCDate();
    const label =
      wsMon === sunMon && wsDay === sunDay
        ? `${wsMon}/${wsDay}`
        : `${wsMon}/${wsDay}-${sunMon}/${sunDay}`;
    weeks.push({ start: ws, end: we, label });
  }
  return weeks;
}

/**
 * Pad daily buckets across [start, end) so every day in the range appears,
 * even days with no transactions (amount = 0).
 *
 * Used for the current-month Mon-Sun view (FR-C003). Transactions outside
 * [start, end) are dropped (caller's filtering responsibility).
 *
 * - Same-day transactions are summed.
 * - `date` is formatted 'YYYY-MM-DD' (UTC).
 * - Buckets are ordered ascending by date.
 * - `amount` is summed verbatim — sign handling (income + / expense −) is the
 *   caller's concern; this helper does pure per-day aggregation.
 *
 * `start` is expected to be a Monday 00:00:00 UTC and `end` the following
 * Monday 00:00:00 UTC (excl), but the function is general: it walks day by
 * day from `start` up to (but not including) `end`.
 */
export function padDailyBuckets(
  transactions: Array<{ occurredAt: Date; amount: number }>,
  start: Date,
  end: Date,
): Array<{ date: string; amount: number }> {
  const dayMs = 24 * 60 * 60 * 1000;

  // Aggregate transactions into per-day totals (only those inside [start, end)).
  const byDay = new Map<string, number>();
  for (const tx of transactions) {
    const t = tx.occurredAt.getTime();
    if (t < start.getTime() || t >= end.getTime()) continue;
    const key = formatUtcDate(tx.occurredAt);
    byDay.set(key, (byDay.get(key) ?? 0) + tx.amount);
  }

  const out: Array<{ date: string; amount: number }> = [];
  for (let ts = start.getTime(); ts < end.getTime(); ts += dayMs) {
    const key = formatUtcDate(new Date(ts));
    out.push({ date: key, amount: byDay.get(key) ?? 0 });
  }
  return out;
}

/**
 * Get the last 24 months as `{ year, month, label }` (descending, current
 * month first).
 *
 * - `month` is 1-12 (calendar month, not JS 0-indexed).
 * - `label` uses `'YYYY年M月'` (no leading zero): `'2026年7月'`, not
 *   `'2026年07月'`.
 * - Cross-year rollover handled via `Date.UTC` normalization
 *   (`Date.UTC(2026, -1, 1)` → 2025-12-01).
 *
 * `now` defaults to `new Date()`; tests pass an explicit value.
 */
export function getLast24Months(
  now: Date = new Date(),
): Array<{ year: number; month: number; label: string }> {
  const out: Array<{ year: number; month: number; label: string }> = [];
  const baseYear = now.getUTCFullYear();
  const baseMonth = now.getUTCMonth(); // 0-indexed
  for (let i = 0; i < 24; i++) {
    const anchor = new Date(Date.UTC(baseYear, baseMonth - i, 1));
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth() + 1;
    out.push({ year: y, month: m, label: `${y}年${m}月` });
  }
  return out;
}
