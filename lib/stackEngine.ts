export type PeptideCategory = 
  | 'GLP-1' 
  | 'GIP'
  | 'Amylin'
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
  breakdown: { label: string, value: number }[];
  isCompatible: boolean;
  status: 'excellent' | 'good' | 'caution' | 'unsafe';
}

// Map common peptide names to categories
export function getCategoryFromName(name: string): PeptideCategory {
  const lower = name.toLowerCase();
  
  if (lower.includes('cagrilintide')) return 'Amylin';
  if (lower.includes('tirzepatide') || lower.includes('semaglutide') || lower.includes('retatrutide') || lower.includes('survodutide')) return 'GLP-1';
  if (lower.includes('cjc')) return 'GHRH';
  if (lower.includes('tesamorelin') || lower.includes('sermorelin')) return 'GHRH';
  if (lower.includes('ipamorelin') || lower.includes('ghrp') || lower.includes('hexarelin')) return 'GHRP';
  if (lower.includes('bpc') || lower.includes('tb500') || lower.includes('kpv') || lower.includes('ara290')) return 'Healing';
  if (lower.includes('semax') || lower.includes('selank') || lower.includes('cerebrolysin') || lower.includes('dsip')) return 'Cognition';
  if (lower.includes('ghk') || lower.includes('ahk') || lower.includes('mt-1') || lower.includes('snap-8')) return 'Cosmetic';
  if (lower.includes('aod') || lower.includes('mots-c') || lower.includes('5-amino-1mq') || lower.includes('aicar')) return 'Metabolism';
  
  return 'Other';
}

export function analyzeStack(components: StackComponent[], isOfficialStack: boolean = true, stackSlug?: string): StackAnalysis {
  let synergyScore = isOfficialStack ? 70 : 50; // Base score
  const warnings: string[] = [];
  const tips: string[] = [];
  const breakdown: { label: string, value: number }[] = [];
  let isCompatible = true;

  // Hardcoded proprietary stack overrides
  if (stackSlug && ['lemon-bottle', 'lipo-c', 'l-carnitine', 'glow', 'klow'].includes(stackSlug)) {
    if (stackSlug === 'lemon-bottle') {
      breakdown.push({ label: 'Riboflavin (Vitamin B2) Optimization', value: 33 });
      breakdown.push({ label: 'Bromelain Integration', value: 33 });
      breakdown.push({ label: 'Lecithin Synergism', value: 33 });
    } else if (stackSlug === 'lipo-c') {
      breakdown.push({ label: 'Methionine Optimization', value: 25 });
      breakdown.push({ label: 'Inositol & Choline Integration', value: 50 });
      breakdown.push({ label: 'L-Carnitine Base', value: 24 });
    } else if (stackSlug === 'glow' || stackSlug === 'klow') {
      breakdown.push({ label: 'Glutathione Base', value: 40 });
      breakdown.push({ label: 'Ascorbic Acid Catalysis', value: 30 });
      breakdown.push({ label: 'Zinc Integration', value: 29 });
    } else if (stackSlug === 'l-carnitine') {
      breakdown.push({ label: 'Pure L-Carnitine Base', value: 50 });
      breakdown.push({ label: 'Metabolic Optimization', value: 49 });
    } else {
      breakdown.push({ label: 'Proprietary Blend Optimization', value: 99 });
    }

    return {
      synergyScore: 99,
      warnings: [],
      tips: ['This is a highly optimized, premixed proprietary blend with excellent synergistic properties.'],
      breakdown,
      isCompatible: true,
      status: 'excellent'
    };
  }

  // Exceptional Custom Stacks
  if (stackSlug && (stackSlug.includes('wolverine') || stackSlug.includes('limitless') || stackSlug.includes('shred'))) {
    if (stackSlug.includes('wolverine')) {
      breakdown.push({ label: 'Systemic Healing (TB-500)', value: 45 });
      breakdown.push({ label: 'Localized Repair (BPC-157)', value: 45 });
      breakdown.push({ label: 'Synergistic Recovery Amplification', value: 9 });
    } else if (stackSlug.includes('limitless')) {
      breakdown.push({ label: 'Cognitive Enhancement (Semax)', value: 45 });
      breakdown.push({ label: 'Anxiolytic Synergy (Selank)', value: 45 });
      breakdown.push({ label: 'Neuroplasticity Amplification', value: 9 });
    } else if (stackSlug.includes('shred')) {
      breakdown.push({ label: 'Metabolic Optimization', value: 40 });
      breakdown.push({ label: 'Appetite Suppression', value: 40 });
      breakdown.push({ label: 'Lipolytic Amplification', value: 19 });
    }

    return {
      synergyScore: 99,
      warnings: [],
      tips: ['This stack combination represents the gold standard for its target outcome, demonstrating exceptional synergy between its components.'],
      breakdown,
      isCompatible: true,
      status: 'excellent'
    };
  }
  
  if (components.length < 2) {
    if (components.length === 1) {
      const id = components[0].id;
      if (id === 'lemon-bottle' || id === 'lipo-c' || id === 'l-carnitine' || id === 'glow' || id === 'klow') {
        breakdown.push({ label: 'Proprietary Blend Optimization', value: 99 });
        return {
          synergyScore: 99,
          warnings: [],
          tips: ['This is a highly optimized, premixed proprietary blend with excellent synergistic properties.'],
          breakdown,
          isCompatible: true,
          status: 'excellent'
        };
      }
    }
    return {
      synergyScore: 0,
      warnings: [],
      tips: ['Add another compound to analyze stack synergy.'],
      breakdown: [{ label: 'Insufficient Components', value: 0 }],
      isCompatible: true,
      status: 'good'
    };
  }

  breakdown.push({ label: isOfficialStack ? 'Official Stack Base Score' : 'Custom Stack Base Score', value: synergyScore });

  const categories = components.map(c => c.category);
  const glp1Count = categories.filter(c => c === 'GLP-1').length;
  const amylinCount = categories.filter(c => c === 'Amylin').length;
  const ghrhCount = categories.filter(c => c === 'GHRH').length;
  const ghrpCount = categories.filter(c => c === 'GHRP').length;
  const healingCount = categories.filter(c => c === 'Healing').length;

  // 1. Safety & Contraindication Checks
  if (glp1Count > 1) {
    warnings.push('RED ALERT: Stacking multiple GLP-1/GIP agonists is highly discouraged. This creates severe redundant receptor activation, leading to gastrointestinal paralysis, profound hypoglycemia, and rapid muscle catabolism.');
    isCompatible = false;
    synergyScore -= 50;
    breakdown.push({ label: 'Multiple GLP-1/GIP Agonists Penalty', value: -50 });
  }
  
  if (amylinCount > 1) {
    warnings.push('RED ALERT: Stacking multiple Amylin analogs can cause severe nausea and gastric distress.');
    isCompatible = false;
    synergyScore -= 50;
    breakdown.push({ label: 'Multiple Amylin Analogs Penalty', value: -50 });
  }
  
  if (ghrhCount > 1 || ghrpCount > 1) {
    warnings.push('RED ALERT: Competing Secretagogues. Stacking multiple peptides of the exact same class (e.g., two GHRHs or two GHRPs) aggressively competes for the same receptors, causing rapid receptor downregulation without added benefit.');
    synergyScore -= 20;
    isCompatible = false;
    breakdown.push({ label: 'Competing Secretagogues Penalty', value: -20 });
  }

  if (categories.includes('Metabolism') && glp1Count > 0) {
    warnings.push('CAUTION: Stacking aggressive metabolic/lipolytic compounds with GLP-1s can rapidly deplete energy stores. Ensure adequate caloric intake and hydration.');
    synergyScore -= 5;
    breakdown.push({ label: 'Metabolism/GLP-1 Clash Penalty', value: -5 });
  }

  if (components.length > 4) {
    warnings.push('CAUTION: Stacking more than 4 compounds simultaneously increases the risk of unpredictable systemic interactions and immune fatigue.');
    synergyScore -= 10;
    breakdown.push({ label: 'Excessive Compounds Penalty', value: -10 });
  }

  // 2. Synergy Checks
  if (glp1Count === 1 && amylinCount === 1) {
    tips.push('Excellent synergy! Combining a GLP-1 receptor agonist with an Amylin analog produces potent, non-redundant appetite suppression and metabolic optimization.');
    synergyScore += 40;
    breakdown.push({ label: 'GLP-1 + Amylin Synergy', value: 40 });
  }

  if (ghrhCount === 1 && ghrpCount === 1) {
    tips.push('Excellent synergy! Combining a single GHRH and a single GHRP amplifies natural growth hormone pulses exponentially more than either alone.');
    synergyScore += 30;
    breakdown.push({ label: 'GHRH + GHRP Synergy', value: 30 });
  }

  if (healingCount >= 2) {
    tips.push('Strong healing and recovery protocol. BPC-157 and TB-500 work synergistically through different systemic pathways.');
    synergyScore += 20;
    breakdown.push({ label: 'Multi-Pathway Healing Synergy', value: 20 });
  }

  if (categories.includes('GLP-1') && categories.includes('Metabolism')) {
    tips.push('Great fat loss stack! GLP-1s control appetite while metabolic peptides like AOD9604 directly target fat oxidation.');
    synergyScore += 15;
    breakdown.push({ label: 'Fat Loss Optimization', value: 15 });
  }

  // Normalization
  let finalScore = Math.max(0, Math.min(100, synergyScore));
  
  if (finalScore !== synergyScore) {
    const capLabel = finalScore === 100 ? 'Maximum Score Cap' : 'Minimum Score Cap';
    breakdown.push({ label: capLabel, value: finalScore - synergyScore });
  }
  synergyScore = finalScore;

  let status: StackAnalysis['status'] = 'good';
  if (!isCompatible) status = 'unsafe';
  else if (synergyScore >= 88) status = 'excellent';
  else if (synergyScore < 40) status = 'caution';

  return { synergyScore, warnings, tips, breakdown, isCompatible, status };
}
