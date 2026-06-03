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
