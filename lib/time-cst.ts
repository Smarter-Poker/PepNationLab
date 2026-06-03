/**
 * Time helpers anchored to America/Chicago. Used by the weekly invoice
 * cron so billing weeks match the spec ("Mon 00:00 CT → Sun 23:59:59 CT")
 * year-round, including across DST transitions. Pure functions — no I/O.
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
 * DST automatically — CDT (Mar-Nov) → -05:00, CST (Nov-Mar) → -06:00.
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
  // transition window — formatToParts will reliably return CST or CDT.
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
  // the same Chicago day.
  const [y, m, d] = chiToday.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));

  // Back up a full week so we're definitely inside the previous completed
  // Chicago week, then snap to that week's Monday.
  anchor.setUTCDate(anchor.getUTCDate() - 7);
  const day = anchor.getUTCDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  anchor.setUTCDate(anchor.getUTCDate() + diff);

  return anchor.toISOString().slice(0, 10);
}
