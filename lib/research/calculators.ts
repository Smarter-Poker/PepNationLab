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

// ---------------------------------------------------------------------
// NEW UI MATH (PHASE 4 EXPANSIONS)
// ---------------------------------------------------------------------

/** Returns the syringe ticks on common syringes for a given mL volume. */
export function syringeTicks(ml: number): { u100: number; u50: number; u30: number } {
  const units = ml * 100;
  return {
    u100: Math.round(units), 
    u50: Math.round(units), 
    u30: Math.round(units), 
  };
}

export interface DilutionStep {
  stepNumber: number;
  concentration: number;
  transferVolumeMl?: number;
  diluentVolumeMl?: number;
}

export function dilutionSeries(opts: {
  stockConcentration: number;
  dilutionFactor: number;
  steps: number;
  finalVolumeMl?: number;
}): DilutionStep[] {
  const { stockConcentration, dilutionFactor, steps, finalVolumeMl } = opts;
  if (!isFinite(stockConcentration) || stockConcentration <= 0) return [];
  if (!isFinite(dilutionFactor) || dilutionFactor <= 1) return [];
  if (!isFinite(steps) || steps <= 0) return [];
  const max = Math.min(Math.floor(steps), 20);
  const out: DilutionStep[] = [];
  let current = stockConcentration;
  
  const hasVols = isFinite(finalVolumeMl ?? NaN) && (finalVolumeMl ?? 0) > 0;
  const V_total = finalVolumeMl ?? 0;
  // Serial dilution to a fixed per-tube total volume V_total at factor D:
  //   transfer = V_total / D            (volume carried from the previous tube)
  //   diluent  = V_total * (D - 1) / D  (fresh diluent added)
  // so transfer + diluent == V_total exactly. The previous formula
  // (transfer = V/(D-1), diluent = V) produced a per-tube volume of V*D/(D-1)
  // instead of the V the researcher entered (e.g. 111 uL for a 100 uL target at D=10).
  const transferVol = hasVols ? V_total / dilutionFactor : undefined;
  const diluentVol = hasVols ? (V_total * (dilutionFactor - 1)) / dilutionFactor : undefined;

  for (let i = 1; i <= max; i++) {
    current = current / dilutionFactor;
    out.push({ 
      stepNumber: i, 
      concentration: current,
      transferVolumeMl: transferVol,
      diluentVolumeMl: diluentVol,
    });
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
  const Ea = opts.activationEnergyKJmol ?? 83; // default
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
  monthlyCostUsd?: number;
  annualCostUsd?: number;
}

export function costPerDose(opts: {
  vialPriceUsd: number;
  vialMassMg: number;
  dosageMcg: number;
  dosesPerWeek?: number;
}): CostPerDoseResult | null {
  const { vialPriceUsd, vialMassMg, dosageMcg, dosesPerWeek } = opts;
  if (!isFinite(vialPriceUsd) || vialPriceUsd < 0) return null;
  if (!isFinite(vialMassMg) || vialMassMg <= 0) return null;
  if (!isFinite(dosageMcg) || dosageMcg <= 0) return null;
  const vialMassMcg = vialMassMg * 1000;
  const dosesPerVial = vialMassMcg / dosageMcg;
  const dollarsPerDose = dosesPerVial > 0 ? vialPriceUsd / dosesPerVial : 0;
  
  let monthlyCostUsd = 0;
  let annualCostUsd = 0;
  if (isFinite(dosesPerWeek ?? NaN) && (dosesPerWeek ?? 0) > 0) {
     annualCostUsd = dollarsPerDose * (dosesPerWeek as number) * 52;
     monthlyCostUsd = annualCostUsd / 12;
  }
  
  return { dollarsPerDose, dosesPerVial, monthlyCostUsd: monthlyCostUsd || undefined, annualCostUsd: annualCostUsd || undefined };
}

export function vialPooling(opts: {
  vialMassMg: number;
  vialCount: number;
  totalDiluentMl: number;
  transferLossPct?: number;
  pipetteTipType?: 'standard' | 'low-retention';
  viscosityModifier?: 'aqueous' | 'glycerol' | 'viscous';
}): {
  totalMassMg: number;
  concentrationMgPerMl: number;
  solubilityWarning: boolean;
  calculatedLossPct: number;
  recommendation: string;
} | null {
  const { vialMassMg, vialCount, totalDiluentMl, pipetteTipType = 'standard', viscosityModifier = 'aqueous' } = opts;
  if (!isFinite(vialMassMg) || vialMassMg <= 0) return null;
  if (!isFinite(vialCount) || vialCount <= 0) return null;
  if (!isFinite(totalDiluentMl) || totalDiluentMl <= 0) return null;

  let computedLoss = opts.transferLossPct ?? 0;
  if (opts.transferLossPct === undefined || isNaN(opts.transferLossPct)) {
    // Dynamically calculate based on modifiers if user did not provide manual input
    const tipLoss = pipetteTipType === 'low-retention' ? 0.5 : 2.0;
    const viscLoss = viscosityModifier === 'viscous' ? 6.0 : viscosityModifier === 'glycerol' ? 3.0 : 0.0;
    computedLoss = tipLoss + viscLoss;
  }

  const lossPct = Math.max(0, Math.min(100, computedLoss));
  const effectiveVialMass = vialMassMg * (1 - lossPct / 100);
  const totalMassMg = effectiveVialMass * vialCount;
  const conc = totalMassMg / totalDiluentMl;
  const solubilityWarning = conc > 50;

  let recommendation = 'Standard aqueous solution: low transfer loss under standard laboratory pipetting protocols.';
  if (viscosityModifier === 'viscous' || viscosityModifier === 'glycerol') {
    recommendation = `Viscous mixture detected. Recommend using positive displacement pipettes or low-retention tips. Aspirate and dispense slowly, allowing liquid interface to settle to minimize wall adhesion loss of ${lossPct.toFixed(1)}%.`;
  } else if (pipetteTipType === 'standard') {
    recommendation = 'Standard tips in use. Upgrading to low-retention tips will reduce surface retention loss by up to 1.5%.';
  }

  return {
    totalMassMg,
    concentrationMgPerMl: conc,
    solubilityWarning,
    calculatedLossPct: lossPct,
    recommendation,
  };
}

const BULL_BREESE: Record<string, number> = {
  A: 0.61, R: 0.69, N: 0.89, D: 0.61, C: 0.36, Q: 0.97, E: 0.51,
  G: 0.81, H: 0.69, I: -1.45, L: -1.65, K: 0.46, M: -0.66, F: -1.52,
  P: -0.17, S: 0.42, T: 0.29, W: -1.2, Y: -1.43, V: -0.75,
};

export function predictHplcRetentionTime(opts: {
  sequence: string;
  gradientPctBStart?: number;
  gradientPctBEnd?: number;
  gradientMin?: number;
  columnType?: 'C18' | 'C8' | 'C4' | 'HILIC';
  modifier?: 'TFA' | 'FA';
}): number | null {
  const { sequence } = opts;
  const start = opts.gradientPctBStart ?? 5;
  const end = opts.gradientPctBEnd ?? 65;
  const grad = opts.gradientMin ?? 20;
  const col = opts.columnType ?? 'C18';
  const mod = opts.modifier ?? 'TFA';
  
  if (!isFinite(start) || !isFinite(end) || !isFinite(grad)) return null;
  if (!sequence || typeof sequence !== 'string') return null;
  const seq = sequence.replace(/\s+/g, '').toUpperCase();
  if (!seq.length) return null;
  let hydroSum = 0;
  for (const aa of seq) {
    hydroSum += BULL_BREESE[aa] ?? 0;
  }
  const hydroPerResidue = hydroSum / seq.length;
  
  let colFactor = 18;
  let offset = 1.7;
  if (col === 'C8') { colFactor = 16; offset = 1.5; }
  else if (col === 'C4') { colFactor = 14; offset = 1.2; }
  else if (col === 'HILIC') { colFactor = -10; offset = -2.0; }
  
  const targetPctB = Math.min(end, Math.max(start, start + (hydroPerResidue + offset) * colFactor));
  const range = end - start;
  if (range === 0) return null;
  
  let rt = ((targetPctB - start) / range) * grad;
  
  if (mod === 'TFA' && col !== 'HILIC') rt += 0.8;
  else if (mod === 'FA' && col !== 'HILIC') rt += 0.2;
  
  return Math.max(0.5, rt);
}

export interface MassSpecPeak {
  charge: number;
  mz: number;
  intensity: number;
}

const PROTON_MASS = 1.00728;
export const RESIDUE_MASS: Record<string, number> = {
  A: 71.03711, R: 156.10111, N: 114.04293, D: 115.02694, C: 103.00919,
  E: 129.04259, Q: 128.05858, G: 57.02146, H: 137.05891, I: 113.08406,
  L: 113.08406, K: 128.09496, M: 131.04049, F: 147.06841, P: 97.05276,
  S: 87.03203, T: 101.04768, W: 186.07931, Y: 163.06333, V: 99.06841,
};

export function predictMassSpecPeaks(opts: {
  sequence: string;
  mode?: 'positive' | 'negative';
  maxCharge?: number;
  adductMass?: number;
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
  const adduct = opts.adductMass ?? PROTON_MASS;
  for (let n = 1; n <= maxCharge; n++) {
    const mz = (M + n * (isPositive ? adduct : -PROTON_MASS)) / n;
    const peakCenter = Math.min(3, maxCharge / 2);
    const intensity = Math.exp(-Math.abs(n - peakCenter) / 1.5);
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
  recoveredMg: number;
  costPerRecoveredMg: number;
  breakdown: FmocSppsCostBreakdownItem[];
}

export function estimateFmocSppsCost(opts: {
  sequence: string;
  scaleUmol?: number;
  fmocAaCostPerGram?: number;
  resinCostPerGram?: number;
  includeReagents?: boolean;
  chemistry?: 'DIC/Oxyma' | 'HATU/DIEA' | 'HBTU/DIEA';
  synthesisYieldPct?: number;
  purificationYieldPct?: number;
}): FmocSppsCostResult | null {
  const seq = (opts.sequence ?? '').replace(/\s+/g, '').toUpperCase();
  if (!seq.length) return null;
  const scale = Math.max(1, opts.scaleUmol ?? 100);
  const fmocCostPerG = Math.max(0, opts.fmocAaCostPerGram ?? 10);
  const resinCostPerG = Math.max(0, opts.resinCostPerGram ?? 20);
  if (!isFinite(scale) || !isFinite(fmocCostPerG) || !isFinite(resinCostPerG)) return null;
  const includeReagents = opts.includeReagents !== false;
  const chem = opts.chemistry ?? 'DIC/Oxyma';
  const synthYield = Math.max(1, Math.min(100, opts.synthesisYieldPct ?? 90)) / 100;
  const purYield = Math.max(1, Math.min(100, opts.purificationYieldPct ?? 50)) / 100;

  const fmocAaGramsTotal = (seq.length * 5 * scale) / 1000;
  const fmocAaCost = fmocAaGramsTotal * fmocCostPerG;
  const resinGrams = (scale / 1000) * 1.5;
  const resinCost = resinGrams * resinCostPerG;
  
  let reagentMultiplier = 0.15;
  if (chem === 'HATU/DIEA') reagentMultiplier = 0.45;
  else if (chem === 'HBTU/DIEA') reagentMultiplier = 0.20;
  
  const reagentCost = includeReagents ? (seq.length * reagentMultiplier * (scale / 100)) : 0;
  const cleavageCost = 8 + (scale / 100) * 4;
  const laborOverhead = 25 + seq.length * 1.5;

  const total = fmocAaCost + resinCost + reagentCost + cleavageCost + laborOverhead;

  const theoreticalYieldMg = (scale / 1000) * (seq.length * 110);
  const recoveredMg = theoreticalYieldMg * synthYield * purYield;
  const costPerRecoveredMg = recoveredMg > 0 ? total / recoveredMg : 0;

  return {
    totalUsd: Number(total.toFixed(2)),
    recoveredMg: Number(recoveredMg.toFixed(2)),
    costPerRecoveredMg: Number(costPerRecoveredMg.toFixed(2)),
    breakdown: [
      { label: 'Fmoc Amino Acids', costUsd: Number(fmocAaCost.toFixed(2)) },
      { label: 'Resin', costUsd: Number(resinCost.toFixed(2)) },
      { label: `Reagents (${chem})`, costUsd: Number(reagentCost.toFixed(2)) },
      { label: 'Cleavage Cocktail', costUsd: Number(cleavageCost.toFixed(2)) },
      { label: 'Lab Labor & Overhead', costUsd: Number(laborOverhead.toFixed(2)) },
    ],
  };
}

export type SolubilityClassification = 'high' | 'moderate' | 'low';

export interface SolubilityResult {
  predictedSolubilityMgMl: number;
  classification: SolubilityClassification;
  notes: string;
  warnings: string[];
  bufferAdvice?: string;
}

export function predictSolubility(opts: {
  gravy: number;
  isoelectricPoint: number;
  sequenceLength: number;
  sequence?: string;
  pH?: number;
}): SolubilityResult | null {
  const { gravy, isoelectricPoint, sequenceLength, sequence } = opts;
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

  const notes = `pI=${isoelectricPoint.toFixed(2)}; |pI - pH|=${pIDistance.toFixed(2)}; GRAVY=${gravy.toFixed(2)}; n=${sequenceLength}.`;
  
  const warnings: string[] = [];
  let bufferAdvice = '';

  if (sequence) {
    const seq = sequence.toUpperCase();
    const cCount = (seq.match(/C/g) || []).length;
    
    if (cCount >= 2) {
      warnings.push("Contains multiple Cysteines: risk of disulfide aggregation.");
    }
    if (/[VILMFWY]{4,}/.test(seq)) {
      warnings.push("Contains poly-hydrophobic run (>=4 residues): extremely high aggregation risk.");
    }

    if (gravy > 0.5 || /[VILMFWY]{4,}/.test(seq)) {
      bufferAdvice = "Highly hydrophobic peptide sequence. Direct aqueous dissolution may result in immediate precipitation. Recommend pre-dissolving in a minimal volume of sterile 100% DMSO, DMF, or Acetonitrile, then slowly diluting with sterile water or PBS to target concentration.";
    } else if (cCount >= 2) {
      bufferAdvice = "Contains multiple Cysteine residues. High risk of disulfide-bond aggregation over time. Store in oxygen-free de-aerated buffers at acidic pH (<6), or add a reducing agent like DTT/TCEP for long-term analytical storage.";
    } else if (isoelectricPoint < 5) {
      bufferAdvice = "Acidic peptide (pI < 5). Dissolution is favored at alkaline pH. Dilute with basic buffers such as sterile sodium bicarbonate or phosphate-buffered saline (PBS) at pH 7.4–8.0. Avoid acidic diluents.";
    } else if (isoelectricPoint > 8) {
      bufferAdvice = "Basic peptide (pI > 8). Dissolution is favored at acidic pH. Dilute with sterile 0.1% – 1% acetic acid or dilute HCl. Avoid alkaline buffers.";
    } else {
      bufferAdvice = "Hydrophilic peptide. Dissolves readily in standard aqueous buffers (bacteriostatic water or sterile PBS at pH 7.4).";
    }
  } else {
    // Fallback on gravy/pI parameters
    if (gravy > 0.5) {
      bufferAdvice = "Hydrophobic properties predicted (GRAVY > 0.5). Recommend pre-dissolving in DMSO before aqueous dilution.";
    } else if (isoelectricPoint < 5) {
      bufferAdvice = "Acidic properties predicted (pI < 5). Dissolution favored in alkaline buffers (PBS pH 7.4–8.0).";
    } else if (isoelectricPoint > 8) {
      bufferAdvice = "Basic properties predicted (pI > 8). Dissolution favored in acidic diluents (0.6% Acetic Acid).";
    } else {
      bufferAdvice = "Standard peptide profile. Dissolution in bacteriostatic water or sterile PBS pH 7.4 is recommended.";
    }
  }

  return {
    predictedSolubilityMgMl: Number(predicted.toFixed(3)),
    classification,
    notes,
    warnings,
    bufferAdvice,
  };
}

export interface VialQuantityPowerResult {
  vialsNeeded: number;
  totalMg: number;
  perSubjectMg: number;
}

export function vialQuantityPower(opts: {
  groups?: number;
  subjectsPerGroup?: number;
  dosesPerSubjectPerWeek?: number;
  studyDurationWeeks?: number;
  n?: number; // legacy
  dosesPerSubject?: number; // legacy
  mgPerDose: number;
  mgPerVial: number;
  overagePct?: number;
}): VialQuantityPowerResult | null {
  const { mgPerDose, mgPerVial } = opts;
  
  const n = opts.n ?? ((opts.groups ?? 1) * (opts.subjectsPerGroup ?? 1));
  const doses = opts.dosesPerSubject ?? ((opts.dosesPerSubjectPerWeek ?? 1) * (opts.studyDurationWeeks ?? 1));
  
  if (!isFinite(n) || !isFinite(doses) || !isFinite(mgPerDose) || !isFinite(mgPerVial)) return null;
  if (n <= 0 || doses <= 0 || mgPerDose <= 0 || mgPerVial <= 0) return null;
  
  const overage = Math.max(0, Math.min(100, opts.overagePct ?? 0)) / 100;
  const perSubjectMg = doses * mgPerDose;
  const totalMg = perSubjectMg * n;
  const baseVials = Math.ceil(totalMg / mgPerVial);
  const vialsNeeded = Math.ceil(baseVials * (1 + overage));
  
  return {
    vialsNeeded,
    totalMg,
    perSubjectMg,
  };
}
