const NICKNAME_MAP: Record<string, string> = {
  // Longevity / Anti-Aging
  'epithalon': 'The Immortality Peptide',
  'foxo4-dri': 'The Zombie Cell Killer',
  'foxo4 dri': 'The Zombie Cell Killer',
  'glutathione': 'The Master Antioxidant',
  'melatonin': 'The Sleep Hormone',
  'nad+': 'The Anti-Aging Molecule',
  'nad': 'The Anti-Aging Molecule',
  'pinealon': 'The Brain Shield',
  'ss-31': 'The Mitochondria Rescue Peptide',
  'thymalin': 'The Immune Clock Reset',
  'thymosin alpha-1': 'The Immunity Peptide',
  'thymosin alpha 1': 'The Immunity Peptide',
  // Healing / Recovery
  'bpc 157': "God's Peptide",
  'bpc-157': "God's Peptide",
  'kpv': 'The Gut Soother',
  'tb500': 'The Injury Eraser',
  'tb-500': 'The Injury Eraser',
  'thymosin b4': 'The Injury Eraser',
  'thymosin beta 4': 'The Injury Eraser',
  'ara290': 'The Nerve Healer',
  'ara-290': 'The Nerve Healer',
  // Cognitive / Nootropic
  'b12': 'The Energy Shot',
  'cerebrolysin': 'Russian Brain Juice',
  'dsip': 'The Delta Sleep Peptide',
  'll37': "Nature's Antibiotic",
  'll-37': "Nature's Antibiotic",
  'selank': 'The Russian Xanax',
  'semax': 'Adderall In A Bottle',
  'vip': 'The Mold Illness Peptide',
  // Growth Hormone / Peptides
  'cjc-1295 with dac': 'The Set-It-And-Forget-It GHRH',
  'cjc-1295 without dac': 'Mod GRF 1-29',
  'cjc 1295 with dac': 'The Set-It-And-Forget-It GHRH',
  'cjc 1295 without dac': 'Mod GRF 1-29',
  'follistatin': 'The Myostatin Blocker',
  'ghrp-2': 'The Hunger Peptide',
  'ghrp-6': 'The Hunger Bomb',
  'hexarelin': 'The Strongest GHRP',
  'hgh fragment 176-191': 'HGH Frag',
  'hgh frag 176-191': 'HGH Frag',
  'hmg': 'The Fertility Peptide',
  'igf-1lr3': 'Long R3',
  'igf-1 lr3': 'Long R3',
  'igf1 lr3': 'Long R3',
  'ipamorelin': 'The Clean GH Peptide',
  'sermorelin': 'The Anti-Aging GH Peptide',
  'tesamorelin': 'The Belly Fat Killer',
  // Sexual Health
  'hcg': 'The PCT Hormone',
  'kisspeptin-10': 'The Libido Master Switch',
  'kisspeptin 10': 'The Libido Master Switch',
  'oxytocin': 'The Love Hormone',
  'pt-141': 'The Libido Peptide',
  'pt141': 'The Libido Peptide',
  // Beauty / Cosmetic
  'ahk-cu': 'The Hair Growth Copper Peptide',
  'ahk cu': 'The Hair Growth Copper Peptide',
  'ghk-cu': "Nature's Botox",
  'ghk cu': "Nature's Botox",
  'melanotan-1': 'The Tanning Peptide',
  'melanotan 1': 'The Tanning Peptide',
  'mt-1': 'The Tanning Peptide',
  'mt1': 'The Tanning Peptide',
  'mt 1': 'The Tanning Peptide',
  'snap-8': 'The Botox Alternative',
  // Weight Loss / Metabolic
  '5-amino-1mq': 'The Fat Cell Killer',
  'aicar': 'The Exercise Pill',
  'aod9604': 'The Anti-Obesity Fragment',
  'aod 9604': 'The Anti-Obesity Fragment',
  'aod-9604': 'The Anti-Obesity Fragment',
  'cagrilintide': 'The Appetite Off Switch',
  'mots-c': 'The Exercise Mimetic',
  'retatrutide': 'The Triple Threat',
  'semaglutide': 'Ozempic',
  'survodutide': 'The Dual Agonist',
  'tirzepatide': 'Mounjaro',
};

export function getPopularName(productName: string): string | null {
  if (!productName) return null;
  const normalized = productName
    .toLowerCase()
    .trim()
    .replace(/\s+acetate\s*$/i, '')
    .replace(/\s+hydrochloride\s*$/i, '')
    .replace(/\s+hcl\s*$/i, '')
    .replace(/\s+research\s+grade\s*$/i, '')
    .replace(/\s*\([^)]+\)\s*$/, '')
    .trim();
  return NICKNAME_MAP[normalized] ?? NICKNAME_MAP[productName.toLowerCase().trim()] ?? null;
}
