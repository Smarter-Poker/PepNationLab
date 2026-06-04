// Shared gamification scale definitions used by every agent create/edit surface
// (admin create, super-agent create, super-agent edit). Keeping the canonical
// default ladder in one place guarantees all three forms agree and that the
// read-only "Default" view is identical everywhere.

export interface GamificationStep {
  level: number;
  name: string;
  min_volume: number;
  bonus_pct: number; // the per-level Commission % shown in the scale table
}

// The house default scale: starts at 20% and climbs to a 40% ceiling across the
// five monthly-volume tiers ($0 / $2.5K / $7.5K / $20K / $50K+). This ladder is
// read-only in the UI — "See Default Gamification Levels" never lets it change.
export const DEFAULT_GAMIFICATION_LADDER: GamificationStep[] = [
  { level: 1, name: 'Premium', min_volume: 20000, bonus_pct: 40 },
  { level: 2, name: 'Pro',     min_volume: 5000,  bonus_pct: 30 },
  { level: 3, name: 'Rookie',  min_volume: 0,     bonus_pct: 20 },
];

// Platform ceiling: no gamification level may exceed 40%.
export const GAMIFICATION_MAX_PCT = 40;

// A fresh, editable copy of the default ladder (so callers never mutate the
// shared constant when seeding their custom editor).
export function freshDefaultLadder(): GamificationStep[] {
  return DEFAULT_GAMIFICATION_LADDER.map((s) => ({ ...s }));
}

// True when a loaded ladder is byte-for-byte the canonical default — used on the
// edit screen to decide whether to show the agent as "Default" (read-only) or
// "Custom" (adjustable).
export function isDefaultLadder(
  steps: { min_volume: number | string; bonus_pct: number | string }[] | null | undefined,
): boolean {
  if (!Array.isArray(steps) || steps.length !== DEFAULT_GAMIFICATION_LADDER.length) return false;
  return DEFAULT_GAMIFICATION_LADDER.every(
    (d, i) =>
      Number(steps[i]?.min_volume) === d.min_volume &&
      Number(steps[i]?.bonus_pct) === d.bonus_pct,
  );
}
