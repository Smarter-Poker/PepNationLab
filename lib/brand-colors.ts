/**
 * Pep Nation Lab brand color tokens - the single source of truth.
 *
 * The platform palette is Teal / Black / Silver, with Red reserved exclusively
 * for warnings, danger, and disclaimers (see CLAUDE.md). No yellow, gold,
 * amber, orange, blue, purple, or neon green anywhere in the product surface.
 *
 * Import from here instead of hardcoding hex values, so a future palette change
 * is one edit rather than a repo-wide grep.
 */

/* Core brand ------------------------------------------------------------- */
export const TEAL = '#00C4BC';        // primary brand
export const TEAL_BRIGHT = '#2DD4BF'; // secondary / positive
export const TEAL_LIGHT = '#5EEAD4';  // tertiary / "new"

/* Neutrals --------------------------------------------------------------- */
export const PLATINUM = '#D0DAE4';    // premium / high-value
export const SILVER = '#A8B4C0';      // muted / spent / informational
export const SLATE = '#5A6A7A';       // dormant / archived
export const WHITE = '#FFFFFF';

/* Surfaces --------------------------------------------------------------- */
export const BG = '#050A0F';
export const SURFACE = '#0F1923';
export const SURFACE_2 = '#162230';
export const SURFACE_3 = '#1D2D3E';

/* Danger - warnings and disclaimers ONLY --------------------------------- */
export const DANGER = '#E53E3E';      // hard danger (brand spec)
export const DANGER_SOFT = '#F87171'; // caution / at-risk / recoverable error

/**
 * Multi-series chart ramp.
 *
 * Charts genuinely need distinguishable series, so this alternates between the
 * teal family and the neutral family rather than running a single hue ramp
 * (adjacent teals are hard to tell apart). Every entry is still on-brand.
 * Danger-soft sits last so it only appears in charts with many series.
 */
export const CHART_SERIES: readonly string[] = [
  TEAL,          // #00C4BC
  PLATINUM,      // #D0DAE4
  TEAL_BRIGHT,   // #2DD4BF
  SLATE,         // #5A6A7A
  TEAL_LIGHT,    // #5EEAD4
  SILVER,        // #A8B4C0
  DANGER_SOFT,   // #F87171
];

/** Podium / leaderboard ranks (replaces gold-silver-bronze). */
export const RANK_COLORS: readonly string[] = [TEAL, PLATINUM, SILVER];

/** Pick a chart series color by index, wrapping safely. */
export function seriesColor(i: number): string {
  return CHART_SERIES[i % CHART_SERIES.length];
}
