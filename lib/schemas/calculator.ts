/**
 * Reconstitution / research calculator input contracts.
 *
 * The pure math in lib/compounds.ts and lib/research/calculators.ts already
 * null-guards non-finite and non-positive inputs; these schemas give the UI
 * layer a shared, fail-closed way to parse free-text numeric fields BEFORE
 * they reach the math (or a cart quantity), instead of ad-hoc parseFloat().
 */
import { z } from 'zod';

/** A strictly positive, finite lab quantity (mg, mL, mcg, Da...). */
export const positiveQuantity = z.number().finite().positive();

/** Reconstitution: vial mass + diluent volume -> concentration. */
export const ReconstitutionInputSchema = z.object({
  /** Peptide mass in the vial, mg. */
  vialMg: positiveQuantity.max(100_000),
  /** Bacteriostatic water added, mL. */
  diluentMl: positiveQuantity.max(1_000),
  /** Desired draw per administration, mcg (optional -- draw volume calc). */
  desiredMcg: positiveQuantity.max(1_000_000_000).optional(),
});
export type ReconstitutionInput = z.infer<typeof ReconstitutionInputSchema>;

/** Dilution series parameters. */
export const DilutionSeriesInputSchema = z.object({
  stockConcentration: positiveQuantity,
  dilutionFactor: z.number().finite().gt(1),
  steps: z.number().int().min(1).max(50),
  finalVolumeMl: positiveQuantity.optional(),
});
export type DilutionSeriesInput = z.infer<typeof DilutionSeriesInputSchema>;

/**
 * Parse a free-text numeric field (calculator inputs, quantity boxes) into a
 * finite positive number, or null. Never returns NaN/Infinity/negatives --
 * use this instead of bare parseFloat()/Number() on user input.
 */
export function parsePositiveNumber(raw: string | null | undefined, max = Number.MAX_SAFE_INTEGER): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return n;
}
