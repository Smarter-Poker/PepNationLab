// Shared types + pure helpers for the storefront discovery UI. Imported by
// DiscoveryHero (StorefrontDiscovery), MatchResultsDrawer, and GuidedDiscoveryWizard.
import type { Compound } from '@/lib/compounds';

export interface MatchedProduct {
  product_id: string;          // agent_products.id (used by the cart)
  display_name: string;        // what the researcher sees
  compound_slug: string | null;
  price_cents: number;
  evidence_tier: string | null;
  rationale: string;           // plain-English "why this match"
  image_url: string | null;
  in_stock: boolean;
  isStackPartner?: boolean;
  score?: number;
  riskLevel?: string;
  halfLife?: string;
  molecularWeight?: number;
}

export interface ExcludedCompound {
  slug: string;
  displayName: string;
  reason: string;
}

export const getTierPercent = (tier?: string | null) => {
  if (!tier) return 0;
  if (tier === 'approved_drug') return 100;
  if (tier === 'investigational') return 80;
  if (tier === 'preclinical') return 60;
  if (tier === 'research_chemical') return 40;
  if (tier === 'cosmetic') return 20;
  return 0;
};

export const getRiskPercent = (risk?: string | null) => {
  if (!risk) return 0;
  if (risk === 'low') return 100;
  if (risk === 'moderate') return 70;
  if (risk === 'high') return 40;
  if (risk === 'critical') return 15;
  return 0;
};

export const getRiskColor = (risk?: string | null) => {
  if (risk === 'low') return 'linear-gradient(90deg, #C0C5CE, #4FD1C5)';
  if (risk === 'moderate') return 'linear-gradient(90deg, #ED8936, #F6AD55)';
  if (risk === 'high') return 'linear-gradient(90deg, #E53E3E, #FC8181)';
  if (risk === 'critical') return 'linear-gradient(90deg, #9B2C2C, #F56565)';
  return '#A8B4C0';
};


// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------



const RESEARCH_AREA_LABELS: Record<string, string> = {
  weight_management:   'Weight Management\n& Fat Loss',
  metabolic:           'Metabolic',
  healing:             'Healing & Recovery',
  tissue_repair:       'Tissue Repair',
  longevity:           'Longevity',
  cosmetic:            'Skin & Hair',
  cognitive:           'Cognitive',
  sleep:               'Sleep',
  immune:              'Immune',
  hormonal:            'Hormonal Balance',
  gut_health:          'Gut Health',
  pain_inflammation:   'Pain & Inflammation',
  bone_joint:          'Joint & Bone Health',
  sexual_health:       'Sexual Health',
  cardiovascular:      'Cardiovascular',
  muscle_growth:       'Muscle Building',
};

export function labelForArea(area: string): string {
  return RESEARCH_AREA_LABELS[area] || area.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function capitalizeEveryWord(str: string): string {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

/** Collect the unique research areas the agent's catalog actually covers. */
export function deriveAvailableAreas(compoundsBySlug: Record<string, Compound>): string[] {
  const seen = new Set<string>();
  for (const c of Object.values(compoundsBySlug)) {
    for (const area of c.research_areas || []) {
      if (typeof area === 'string' && area.length > 0) {
        if (area === 'hormonal' || area === 'supply') continue;
        seen.add(area);
      }
    }
  }
  // Sort so high-traffic areas float to the front; everything else alpha.
  const PRIORITY = [
    'weight_management', 'healing', 'tissue_repair', 'longevity',
    'cognitive', 'sleep', 'immune', 'metabolic', 'cosmetic',
  ];
  const out = Array.from(seen);
  out.sort((a, b) => {
    const ai = PRIORITY.indexOf(a);
    const bi = PRIORITY.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  return out;
}

export interface WizardState {
  area: string;             // research_area key
  preference: 'single' | 'stack' | 'either';
  comfort: 'strict_human_only' | 'investigational_ok' | 'preclinical_ok' | 'any';
  budget: 'conservative' | 'standard' | 'unlimited';
}

export const DEFAULT_WIZARD: WizardState = {
  area: 'healing',
  preference: 'either',
  comfort: 'preclinical_ok',
  budget: 'standard',
};

export function buildGoalFromWizard(state: WizardState): string {
  const area = labelForArea(state.area);
  const pref =
    state.preference === 'single' ? 'Single Compound' :
    state.preference === 'stack'  ? 'Blended Stack' :
                                    'Either Single Or Stack';
  return `${area} Goal · ${pref}`;
}
