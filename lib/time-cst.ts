/**
 * Time helpers anchored to America/Chicago. Used by the weekly invoice
 * cron so billing weeks match the spec ("Mon 00:00 CT → Sun 23:59:59 CT")
 * year-round, including across DST transitions. Pure functions - no I/O.
 */

/** True if America/Chicago is observing CDT (daylight savings) at `at`. */
function isCdt(at: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  }).formatToParts(at);
  const abbr = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  return abbr === 'CDT';
}

/**
 * Convert a YYYY-MM-DD calendar date in America/Chicago into an ISO
 * timestamptz string representing 00:00:00 local on that date. Honors
 * DST automatically - CDT (Mar-Nov) → -05:00, CST (Nov-Mar) → -06:00.
 *
 * Example:
 *   chicagoMidnightIso('2026-06-15') === '2026-06-15T00:00:00-05:00'  (CDT)
 *   chicagoMidnightIso('2026-12-15') === '2026-12-15T00:00:00-06:00'  (CST)
 */
export function chicagoMidnightIso(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`chicagoMidnightIso: expected YYYY-MM-DD, got ${dateStr}`);
  }
  // Probe at noon UTC on the same calendar day so we're far from any DST
  // transition window - formatToParts will reliably return CST or CDT.
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const offset = isCdt(probe) ? '-05:00' : '-06:00';
  return `${dateStr}T00:00:00${offset}`;
}

/**
 * Snap `now` to the Monday (YYYY-MM-DD) that begins the most-recently
 * completed week in America/Chicago. The cron fires Monday 05:59 UTC
 * (= Sunday 23:59 CST or Monday 00:59 CDT); the "previous completed
 * week" is the Mon→Sun window that just closed at that fire time.
 *
 * Always returns a Monday calendar date in Chicago.
 */
export function previousCompletedWeekStartCst(now: Date): string {
  // "Today" in Chicago at the moment the cron fires. en-CA's locale
  // formatter always emits YYYY-MM-DD which is what we want.
  const chiToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  // Parse the YYYY-MM-DD into components and build a noon-UTC anchor on
  // the same calendar day so subsequent UTC date arithmetic stays inside
  // the same Chicago day (noon UTC = 6-7am Chicago, so getUTCDay() reports
  // Chicago's weekday for that date).
  const [y, m, d] = chiToday.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));

  // DST-safe week selection. The invoice cron is scheduled Monday 05:59 UTC.
  // That single instant is Monday 00:59 CDT in summer but Sunday 23:59 CST in
  // winter, so the fire's Chicago CALENDAR DAY flips between Monday and Sunday
  // across the DST boundary. Deriving the week from the fire day directly
  // (snapping the fire day itself to a Monday) therefore jumps by a whole week
  // at each transition: at spring-forward one Mon->Sun week is silently SKIPPED
  // and never billed; at fall-back one week is re-attempted (deduped) then
  // delayed.
  //
  // Anchor to YESTERDAY in Chicago and snap THAT to its week's Monday instead.
  // Consecutive Monday 05:59 UTC fires are exactly 168h apart, so this always
  // advances the billed Monday by exactly 7 days regardless of DST:
  //   CDT fire (Mon 00:59): yesterday = Sunday   -> the week that just closed
  //   CST fire (Sun 23:59): yesterday = Saturday -> the week closing at midnight
  // Every Mon->Sun week is billed once and only once, with no gap (spring) and
  // no duplicate (fall) across the transitions.
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  const day = anchor.getUTCDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // snap back to that week's Monday
  anchor.setUTCDate(anchor.getUTCDate() + diff);

  return anchor.toISOString().slice(0, 10);
}
