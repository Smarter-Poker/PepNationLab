/**
 * Researcher calculators -- pure math helpers shared by /research/calculators
 * and the InstantAnswerCard. No IO, safe in client or server.
 *
 * Research use only. Lab-prep math, not human dosing.
 */

export {
  reconstitutionVolumeMl,
  drawVolumeMl,
  shelfLife,
  type ShelfLife,
} from '@/lib/compounds';

export type ConcentrationUnit =
  | 'mg/mL'
  | 'mcg/mL'
  | 'ng/mL'
  | 'mmol/L'
  | 'umol/L'
  | 'nmol/L';

const MASS_TO_MG_PER_ML: Record<string, number | null> = {
  'mg/mL': 1,
  'mcg/mL': 1 / 1000,
  'ng/mL': 1 / 1_000_000,
};

const MOLAR_TO_MOL_PER_L: Record<string, number | null> = {
  'mmol/L': 1 / 1000,
  'umol/L': 1 / 1_000_000,
  'nmol/L': 1 / 1_000_000_000,
};

function isMassUnit(unit: ConcentrationUnit): boolean {
  return unit === 'mg/mL' || unit === 'mcg/mL' || unit === 'ng/mL';
}

function isMolarUnit(unit: ConcentrationUnit): boolean {
  return unit === 'mmol/L' || unit === 'umol/L' || unit === 'nmol/L';
}

export interface ConcentrationConvertInput {
  value: number;
  fromUnit: ConcentrationUnit;
  toUnit: ConcentrationUnit;
  molecularWeightDa?: number | null;
}

export function concentrationConvert(input: ConcentrationConvertInput): number | null {
  const { value, fromUnit, toUnit, molecularWeightDa } = input;
  if (!isFinite(value)) return null;
  if (fromUnit === toUnit) return value;

  if (isMassUnit(fromUnit) && isMassUnit(toUnit)) {
    const f = MASS_TO_MG_PER_ML[fromUnit];
    const t = MASS_TO_MG_PER_ML[toUnit];
    if (!f || !t) return null;
    return (value * f) / t;
  }

  if (isMolarUnit(fromUnit) && isMolarUnit(toUnit)) {
    const f = MOLAR_TO_MOL_PER_L[fromUnit];
    const t = MOLAR_TO_MOL_PER_L[toUnit];
    if (!f || !t) return null;
    return (value * f) / t;
  }

  if (!molecularWeightDa || molecularWeightDa <= 0) return null;

  if (isMassUnit(fromUnit) && isMolarUnit(toUnit)) {
    const fMassMgPerMl = MASS_TO_MG_PER_ML[fromUnit];
    const tMolarMolPerL = MOLAR_TO_MOL_PER_L[toUnit];
    if (!fMassMgPerMl || !tMolarMolPerL) return null;
    const gPerL = value * fMassMgPerMl;
    const molPerL = gPerL / molecularWeightDa;
    return molPerL / tMolarMolPerL;
  }

  if (isMolarUnit(fromUnit) && isMassUnit(toUnit)) {
    const fMolarMolPerL = MOLAR_TO_MOL_PER_L[fromUnit];
    const tMassMgPerMl = MASS_TO_MG_PER_ML[toUnit];
    if (!fMolarMolPerL || !tMassMgPerMl) return null;
    const molPerL = value * fMolarMolPerL;
    const gPerL = molPerL * molecularWeightDa;
    return gPerL / tMassMgPerMl;
  }

  return null;
}

export interface DilutionStep {
  stepNumber: number;
  concentration: number;
}

export function dilutionSeries(opts: {
  stockConcentration: number;
  dilutionFactor: number;
  steps: number;
}): DilutionStep[] {
  const { stockConcentration, dilutionFactor, steps } = opts;
  if (!isFinite(stockConcentration) || stockConcentration <= 0) return [];
  if (!isFinite(dilutionFactor) || dilutionFactor <= 1) return [];
  if (!isFinite(steps) || steps <= 0) return [];
  const max = Math.min(Math.floor(steps), 20);
  const out: DilutionStep[] = [];
  let current = stockConcentration;
  for (let i = 1; i <= max; i++) {
    current = current / dilutionFactor;
    out.push({ stepNumber: i, concentration: current });
  }
  return out;
}

export function arrheniusStability(opts: {
  shelfDaysAtTempC: number;
  fromTempC: number;
  toTempC: number;
  activationEnergyKJmol?: number;
}): number | null {
  const { shelfDaysAtTempC, fromTempC, toTempC } = opts;
  const Ea = opts.activationEnergyKJmol ?? 83;
  if (!isFinite(shelfDaysAtTempC) || shelfDaysAtTempC <= 0) return null;
  if (!isFinite(fromTempC) || !isFinite(toTempC)) return null;
  if (!isFinite(Ea)) return null;
  const R = 8.314 / 1000;
  const T1 = fromTempC + 273.15;
  const T2 = toTempC + 273.15;
  if (T1 <= 0 || T2 <= 0) return null;
  const exponent = (Ea / R) * (1 / T2 - 1 / T1);
  const factor = Math.exp(exponent);
  return shelfDaysAtTempC * factor;
}

export interface CostPerDoseResult {
  dollarsPerDose: number;
  dosesPerVial: number;
}

export function costPerDose(opts: {
  vialPriceUsd: number;
  vialMassMg: number;
  dosageMcg: number;
}): CostPerDoseResult | null {
  const { vialPriceUsd, vialMassMg, dosageMcg } = opts;
  if (!isFinite(vialPriceUsd) || vialPriceUsd < 0) return null;
  if (!isFinite(vialMassMg) || vialMassMg <= 0) return null;
  if (!isFinite(dosageMcg) || dosageMcg <= 0) return null;
  const vialMassMcg = vialMassMg * 1000;
  const dosesPerVial = vialMassMcg / dosageMcg;
  const dollarsPerDose = dosesPerVial > 0 ? vialPriceUsd / dosesPerVial : 0;
  return { dollarsPerDose, dosesPerVial };
}

export function vialPooling(opts: {
  vialMassMg: number;
  vialCount: number;
  totalDiluentMl: number;
}): { totalMassMg: number; concentrationMgPerMl: number } | null {
  const { vialMassMg, vialCount, totalDiluentMl } = opts;
  if (!isFinite(vialMassMg) || vialMassMg <= 0) return null;
  if (!isFinite(vialCount) || vialCount <= 0) return null;
  if (!isFinite(totalDiluentMl) || totalDiluentMl <= 0) return null;
  const totalMassMg = vialMassMg * vialCount;
  return { totalMassMg, concentrationMgPerMl: totalMassMg / totalDiluentMl };
}

/* -----------------------------------------------------------
 * Wave 2 additions -- five new researcher calculators.
 * All pure math, all framed for laboratory research use only.
 * --------------------------------------------------------- */

/**
 * Bull-Breese hydrophobicity coefficients (rough lab estimate, not clinical).
 * Source: Bull & Breese (1974) hydrophobicity scale.
 */
const BULL_BREESE: Record<string, number> = {
  A: 0.61, R: 0.69, N: 0.89, D: 0.61, C: 0.36, Q: 0.97, E: 0.51,
  G: 0.81, H: 0.69, I: -1.45, L: -1.65, K: 0.46, M: -0.66, F: -1.52,
  P: -0.17, S: 0.42, T: 0.29, W: -1.2, Y: -1.43, V: -0.75,
};

/**
 * predictHplcRetentionTime -- rough RT estimate for a C18 column based on
 * Bull-Breese hydrophobicity sum. Returns minutes. Lab estimate, not clinical.
 */
export function predictHplcRetentionTime(opts: {
  sequence: string;
  gradientPctBStart?: number;
  gradientPctBEnd?: number;
  gradientMin?: number;
  c18Column?: boolean;
}): number | null {
  const { sequence } = opts;
  const start = opts.gradientPctBStart ?? 5;
  const end = opts.gradientPctBEnd ?? 65;
  const grad = opts.gradientMin ?? 20;
  const c18 = opts.c18Column !== false;
  if (!isFinite(start) || !isFinite(end) || !isFinite(grad)) return null;
  if (!sequence || typeof sequence !== 'string') return null;
  const seq = sequence.replace(/\s+/g, '').toUpperCase();
  if (!seq.length) return null;
  let hydroSum = 0;
  for (const aa of seq) {
    hydroSum += BULL_BREESE[aa] ?? 0;
  }
  const hydroPerResidue = hydroSum / seq.length;
  const targetPctB = Math.min(end, Math.max(start, start + (hydroPerResidue + 1.7) * 18));
  const range = end - start;
  if (range <= 0) return null;
  const rt = ((targetPctB - start) / range) * grad;
  return Math.max(0.5, c18 ? rt + 1.2 : rt + 0.6);
}

export interface MassSpecPeak {
  charge: number;
  mz: number;
  intensity: number;
}

const PROTON_MASS = 1.00728;

/**
 * Approximate monoisotopic mass from the canonical 20 amino acid residue masses.
 * (Sum of residue masses + 18.0106 for water.)
 */
const RESIDUE_MASS: Record<string, number> = {
  A: 71.03711, R: 156.10111, N: 114.04293, D: 115.02694, C: 103.00919,
  E: 129.04259, Q: 128.05858, G: 57.02146, H: 137.05891, I: 113.08406,
  L: 113.08406, K: 128.09496, M: 131.04049, F: 147.06841, P: 97.05276,
  S: 87.03203, T: 101.04768, W: 186.07931, Y: 163.06333, V: 99.06841,
};

/**
 * predictMassSpecPeaks -- expected [M+nH]^n+ peaks for the given sequence.
 * Returns an array of charge / m/z / intensity tuples in descending intensity.
 */
export function predictMassSpecPeaks(opts: {
  sequence: string;
  mode?: 'positive' | 'negative';
  maxCharge?: number;
}): MassSpecPeak[] {
  const seq = (opts.sequence ?? '').replace(/\s+/g, '').toUpperCase();
  const rawCharge = opts.maxCharge ?? 4;
  if (!isFinite(rawCharge)) return [];
  const maxCharge = Math.min(Math.max(rawCharge, 1), 10);
  if (!seq.length) return [];
  let M = 18.0106;
  for (const aa of seq) {
    M += RESIDUE_MASS[aa] ?? 110;
  }
  const peaks: MassSpecPeak[] = [];
  const isPositive = (opts.mode ?? 'positive') === 'positive';
  for (let n = 1; n <= maxCharge; n++) {
    const mz = (M + n * (isPositive ? PROTON_MASS : -PROTON_MASS)) / n;
    const intensity = Math.exp(-Math.abs(n - 2) / 1.5);
    peaks.push({ charge: n, mz: Number(mz.toFixed(4)), intensity: Number(intensity.toFixed(3)) });
  }
  return peaks.sort((a, b) => b.intensity - a.intensity);
}

export interface FmocSppsCostBreakdownItem {
  label: string;
  costUsd: number;
}

export interface FmocSppsCostResult {
  totalUsd: number;
  breakdown: FmocSppsCostBreakdownItem[];
}

/**
 * estimateFmocSppsCost -- rough cost estimate for synthesizing a peptide
 * via Fmoc-SPPS at the given umol scale.
 */
export function estimateFmocSppsCost(opts: {
  sequence: string;
  scaleUmol?: number;
  fmocAaCostPerGram?: number;
  resinCostPerGram?: number;
  includeReagents?: boolean;
}): FmocSppsCostResult | null {
  const seq = (opts.sequence ?? '').replace(/\s+/g, '').toUpperCase();
  if (!seq.length) return null;
  const scale = Math.max(1, opts.scaleUmol ?? 100);
  const fmocCostPerG = Math.max(0, opts.fmocAaCostPerGram ?? 10);
  const resinCostPerG = Math.max(0, opts.resinCostPerGram ?? 20);
  if (!isFinite(scale) || !isFinite(fmocCostPerG) || !isFinite(resinCostPerG)) return null;
  const includeReagents = opts.includeReagents !== false;

  const fmocAaGramsTotal = (seq.length * 5 * scale) / 1000;
  const fmocAaCost = fmocAaGramsTotal * fmocCostPerG;
  const resinGrams = (scale / 1000) * 1.5;
  const resinCost = resinGrams * resinCostPerG;
  const reagentCost = includeReagents ? (seq.length * 0.15 * (scale / 100)) : 0;
  const cleavageCost = 8 + (scale / 100) * 4;
  const laborOverhead = 25 + seq.length * 1.5;

  const total = fmocAaCost + resinCost + reagentCost + cleavageCost + laborOverhead;

  return {
    totalUsd: Number(total.toFixed(2)),
    breakdown: [
      { label: 'Fmoc Amino Acids', costUsd: Number(fmocAaCost.toFixed(2)) },
      { label: 'Resin', costUsd: Number(resinCost.toFixed(2)) },
      { label: 'Coupling Reagents', costUsd: Number(reagentCost.toFixed(2)) },
      { label: 'Cleavage Cocktail', costUsd: Number(cleavageCost.toFixed(2)) },
      { label: 'Lab Labor And Overhead', costUsd: Number(laborOverhead.toFixed(2)) },
    ],
  };
}

export type SolubilityClassification = 'high' | 'moderate' | 'low';

export interface SolubilityResult {
  predictedSolubilityMgMl: number;
  classification: SolubilityClassification;
  notes: string;
}

/**
 * predictSolubility -- heuristic solubility prediction. Uses GRAVY,
 * pI distance from pH, and sequence length.
 */
export function predictSolubility(opts: {
  gravy: number;
  isoelectricPoint: number;
  sequenceLength: number;
  pH?: number;
}): SolubilityResult | null {
  const { gravy, isoelectricPoint, sequenceLength } = opts;
  const pH = opts.pH ?? 7.4;
  if (!isFinite(gravy) || !isFinite(isoelectricPoint) || !isFinite(sequenceLength) || !isFinite(pH)) return null;
  if (sequenceLength <= 0) return null;

  const pIDistance = Math.abs(isoelectricPoint - pH);
  const lengthPenalty = Math.max(0, (sequenceLength - 40) / 80);

  const score = (pIDistance * 1.5) - (gravy * 2.5) - lengthPenalty;
  const predicted = Math.max(0.05, Math.min(50, Math.exp(score - 1.2)));

  let classification: SolubilityClassification = 'moderate';
  if (predicted >= 5) classification = 'high';
  else if (predicted < 0.5) classification = 'low';

  const notes = `pI=${isoelectricPoint.toFixed(2)}; |pI - pH|=${pIDistance.toFixed(2)}; GRAVY=${gravy.toFixed(2)}; n=${sequenceLength}. Heuristic Estimate.`;

  return {
    predictedSolubilityMgMl: Number(predicted.toFixed(3)),
    classification,
    notes,
  };
}

export interface VialQuantityPowerResult {
  vialsNeeded: number;
  totalMg: number;
  perSubjectMg: number;
}

/**
 * vialQuantityPower -- compute the number of vials needed for a study of n
 * subjects, given a per-subject dose count and per-dose mass.
 */
export function vialQuantityPower(opts: {
  n: number;
  dosesPerSubject: number;
  mgPerDose: number;
  mgPerVial: number;
}): VialQuantityPowerResult | null {
  const { n, dosesPerSubject, mgPerDose, mgPerVial } = opts;
  if (!isFinite(n) || !isFinite(dosesPerSubject) || !isFinite(mgPerDose) || !isFinite(mgPerVial)) return null;
  if (n <= 0 || dosesPerSubject <= 0 || mgPerDose <= 0 || mgPerVial <= 0) return null;
  const perSubjectMg = dosesPerSubject * mgPerDose;
  const totalMg = perSubjectMg * n;
  const vialsNeeded = Math.ceil(totalMg / mgPerVial);
  return {
    vialsNeeded,
    totalMg,
    perSubjectMg,
  };
}
