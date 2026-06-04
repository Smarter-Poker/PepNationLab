export type PeptideCategory = 
  | 'GLP-1' 
  | 'GIP'
  | 'GHRH' 
  | 'GHRP' 
  | 'Healing' 
  | 'Cognition' 
  | 'Cosmetic'
  | 'Metabolism'
  | 'Other';

export interface StackComponent {
  id: string;
  name: string;
  category: PeptideCategory;
}

export interface StackAnalysis {
  synergyScore: number; // 0 to 100
  warnings: string[];
  tips: string[];
  isCompatible: boolean;
  status: 'excellent' | 'good' | 'caution' | 'unsafe';
}

// Map common peptide names to categories
export function getCategoryFromName(name: string): PeptideCategory {
  const lower = name.toLowerCase();
  
  if (lower.includes('tirzepatide') || lower.includes('semaglutide') || lower.includes('retatrutide') || lower.includes('cagrilintide') || lower.includes('survodutide')) return 'GLP-1';
  if (lower.includes('cjc')) return 'GHRH';
  if (lower.includes('tesamorelin') || lower.includes('sermorelin')) return 'GHRH';
  if (lower.includes('ipamorelin') || lower.includes('ghrp') || lower.includes('hexarelin')) return 'GHRP';
  if (lower.includes('bpc') || lower.includes('tb500') || lower.includes('kpv') || lower.includes('ara290')) return 'Healing';
  if (lower.includes('semax') || lower.includes('selank') || lower.includes('cerebrolysin') || lower.includes('dsip')) return 'Cognition';
  if (lower.includes('ghk') || lower.includes('ahk') || lower.includes('mt-1') || lower.includes('snap-8')) return 'Cosmetic';
  if (lower.includes('aod') || lower.includes('mots-c') || lower.includes('5-amino-1mq') || lower.includes('aicar')) return 'Metabolism';
  
  return 'Other';
}

export function analyzeStack(components: StackComponent[]): StackAnalysis {
  let synergyScore = 50; // Base score
  const warnings: string[] = [];
  const tips: string[] = [];
  let isCompatible = true;
  
  if (components.length < 2) {
    return {
      synergyScore: 0,
      warnings: [],
      tips: ['Add another compound to analyze stack synergy.'],
      isCompatible: true,
      status: 'good'
    };
  }

  const categories = components.map(c => c.category);
  const glp1Count = categories.filter(c => c === 'GLP-1').length;
  const ghrhCount = categories.filter(c => c === 'GHRH').length;
  const ghrpCount = categories.filter(c => c === 'GHRP').length;
  const healingCount = categories.filter(c => c === 'Healing').length;

  // 1. Safety Checks
  if (glp1Count > 1) {
    warnings.push('Stacking multiple GLP-1/GIP agonists is highly discouraged due to redundant mechanisms and increased risk of severe side effects (hypoglycemia, GI distress).');
    isCompatible = false;
    synergyScore -= 40;
  }
  
  if (components.length > 4) {
    warnings.push('Stacking more than 4 compounds simultaneously increases the risk of unpredictable interactions and receptor fatigue.');
    synergyScore -= 10;
  }

  // 2. Synergy Checks
  if (ghrhCount > 0 && ghrpCount > 0) {
    tips.push('Excellent synergy! Combining a GHRH and a GHRP amplifies natural growth hormone pulses significantly more than either alone.');
    synergyScore += 30;
  } else if (ghrhCount > 1 || ghrpCount > 1) {
    warnings.push('Stacking multiple peptides of the same class (e.g., two GHRPs) usually competes for the same receptors without added benefit.');
    synergyScore -= 10;
  }

  if (healingCount >= 2) {
    tips.push('Strong healing and recovery protocol. BPC-157 and TB-500 work synergistically through different systemic pathways.');
    synergyScore += 20;
  }

  if (categories.includes('GLP-1') && categories.includes('Metabolism')) {
    tips.push('Great fat loss stack! GLP-1s control appetite while metabolic peptides like AOD9604 directly target fat oxidation.');
    synergyScore += 15;
  }

  // Normalization
  synergyScore = Math.max(0, Math.min(100, synergyScore));

  let status: StackAnalysis['status'] = 'good';
  if (!isCompatible) status = 'unsafe';
  else if (synergyScore >= 80) status = 'excellent';
  else if (synergyScore < 40) status = 'caution';

  return { synergyScore, warnings, tips, isCompatible, status };
}
