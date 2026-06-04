import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('compounds.json', 'utf8'));

const expansions: Record<string, { aliases: string[], studied_for: string[] }> = {
  "bpc-157": {
    aliases: ["Wolverine peptide", "healing peptide", "BPC 157", "BPC-157", "Body Protection Compound"],
    studied_for: ["joint healing", "gut healing", "tendon repair", "ulcer repair", "ligament healing", "muscle tear recovery", "leaky gut", "inflammation reduction", "pain relief", "soft tissue repair"]
  },
  "tb-500": {
    aliases: ["thymosin beta 4", "TB500", "TB 500", "Tbeta4"],
    studied_for: ["muscle recovery", "cardiac repair", "wound healing", "equine recovery", "tissue regeneration", "anti-inflammatory", "flexibility", "hair growth", "stem cell migration"]
  },
  "semaglutide": {
    aliases: ["Ozempic", "Wegovy", "Rybelsus", "GLP-1", "GLP1", "sema"],
    studied_for: ["weight loss", "fat loss", "appetite suppressant", "incretin", "anti-obesity", "diabetes", "blood sugar control", "cardiovascular health", "binge eating", "craving reduction"]
  },
  "tirzepatide": {
    aliases: ["Mounjaro", "Zepbound", "GIP/GLP-1", "twincretin", "tirz", "tzp"],
    studied_for: ["weight loss", "diabetes", "fat loss", "appetite suppression", "obesity", "metabolic syndrome", "insulin sensitivity", "A1C reduction"]
  },
  "retatrutide": {
    aliases: ["triple agonist", "GLP-1/GIP/GCG", "glucagon receptor", "reta", "ret"],
    studied_for: ["extreme weight loss", "obesity", "liver fat reduction", "NAFLD", "metabolic rate increase", "appetite suppression", "lipid lowering"]
  },
  "cagrilintide": {
    aliases: ["amylin analog", "amylin receptor agonist", "cagri"],
    studied_for: ["weight loss", "satiety", "appetite suppression", "gastric emptying slowing", "obesity"]
  },
  "survodutide": {
    aliases: ["GLP-1/glucagon dual agonist", "survo", "dual agonist"],
    studied_for: ["weight loss", "liver fat reduction", "NASH", "NAFLD", "obesity", "energy expenditure increase"]
  },
  "ipamorelin": {
    aliases: ["growth hormone secretagogue", "GHS", "ipa"],
    studied_for: ["anti-aging", "muscle growth", "fat loss", "recovery", "deep sleep", "bone density", "cellular repair", "GH pulse stimulation"]
  },
  "cjc-1295-no-dac": {
    aliases: ["MOD GRF 1-29", "GHRH", "growth hormone releasing hormone", "CJC 1295", "CJC no DAC"],
    studied_for: ["muscle growth", "fat loss", "deep sleep", "anti-aging", "vitality", "collagen production", "recovery"]
  },
  "cjc-1295-dac": {
    aliases: ["CJC with DAC", "Drug Affinity Complex", "long acting GHRH", "CJC-1295 DAC"],
    studied_for: ["continuous GH release", "muscle growth", "fat loss", "IGF-1 elevation", "recovery"]
  },
  "tesamorelin": {
    aliases: ["Egrifta", "GHRH", "tesa", "tesamorelin acetate"],
    studied_for: ["visceral fat reduction", "belly fat", "HIV lipodystrophy", "muscle growth", "body composition", "lipid profile improvement", "cognitive function"]
  },
  "aod9604": {
    aliases: ["fat burning peptide", "lipolysis", "obesity", "anti-obesity", "fragment 177-191", "AOD 9604"],
    studied_for: ["weight loss", "fat burning", "stubborn fat", "cartilage repair", "osteoarthritis"]
  },
  "ghk-cu": {
    aliases: ["copper peptide", "GHK copper", "blue peptide"],
    studied_for: ["skin tightening", "anti-aging", "hair growth", "wrinkle repair", "collagen production", "scar reduction", "wound healing", "antioxidant", "tissue remodeling"]
  },
  "epithalon": {
    aliases: ["Epitalon", "pineal gland peptide", "telomerase activator", "epithalamin", "AGAG"],
    studied_for: ["longevity", "anti-aging", "sleep regulation", "life extension", "circadian rhythm", "melatonin production", "telomere lengthening", "antioxidant"]
  },
  "thymosin-alpha-1": {
    aliases: ["Zadaxin", "TA1", "TA-1", "thymalfasin"],
    studied_for: ["immune booster", "T-cell modulation", "viral infection", "autoimmune", "immunomodulator", "Lyme disease", "chronic fatigue", "cancer adjunctive", "vaccine efficacy"]
  },
  "mots-c": {
    aliases: ["mitochondrial peptide", "exercise mimetic", "MOTSc", "MOTS c"],
    studied_for: ["metabolic regulation", "energy boost", "AMPK activator", "weight loss", "insulin sensitivity", "exercise endurance", "mitochondrial function"]
  },
  "ss-31": {
    aliases: ["Elamipretide", "Bendavia", "mitochondrial targeting", "cardiolipin"],
    studied_for: ["energy production", "anti-aging", "mitochondrial repair", "heart failure", "cognitive decline", "ischemia reperfusion", "kidney protection"]
  },
  "5-amino-1mq": {
    aliases: ["5-amino-1-methylquinolinium", "NNMT inhibitor", "5amino1mq"],
    studied_for: ["fat burning", "metabolism booster", "weight loss", "muscle wasting prevention", "cellular energy", "anti-aging", "NAD+ salvage pathway"]
  },
  "aicar": {
    aliases: ["AMPK activator", "exercise in a bottle", "acadesine", "ZMP"],
    studied_for: ["endurance enhancement", "fat burning", "metabolic regulator", "ischemic protection", "muscle metabolism"]
  },
  "selank": {
    aliases: ["anti-anxiety", "nootropic", "anxiolytic", "Tuftsin analog"],
    studied_for: ["stress relief", "cognitive enhancement", "focus", "anxiety reduction", "depression", "immune modulation", "BDNF increase"]
  },
  "semax": {
    aliases: ["nootropic", "ACTH analog", "brain peptide"],
    studied_for: ["brain fog", "cognitive enhancement", "ADHD", "stroke recovery", "neuroprotection", "memory improvement", "BDNF increase", "focus"]
  },
  "cerebrolysin": {
    aliases: ["neurotrophic peptide", "brain healing", "porcine brain extract"],
    studied_for: ["TBI recovery", "Alzheimer's research", "dementia", "neurogenesis", "stroke recovery", "cognitive decline", "neurological repair"]
  },
  "pinealon": {
    aliases: ["pineal peptide", "bioregulator", "short peptide"],
    studied_for: ["brain health", "circadian rhythm", "cognitive function", "memory", "anti-aging", "neurological repair"]
  },
  "pt-141": {
    aliases: ["Bremelanotide", "Vyleesi", "PT 141", "melanocortin agonist"],
    studied_for: ["libido", "erectile dysfunction", "ED", "female sexual arousal disorder", "aphrodisiac", "sexual dysfunction"]
  },
  "kisspeptin-10": {
    aliases: ["metastin", "KP-10", "KP10"],
    studied_for: ["testosterone boost", "fertility", "libido", "LH/FSH stimulation", "HPTA restart", "hypogonadism"]
  },
  "mt-1": {
    aliases: ["Melanotan 1", "Afamelanotide", "Scenesse", "tanning peptide", "MT1"],
    studied_for: ["skin pigmentation", "sunless tan", "phototoxicity prevention", "vitiligo", "erythropoietic protoporphyria"]
  },
  "melatonin": {
    aliases: ["sleep hormone", "pineal hormone"],
    studied_for: ["sleep", "circadian rhythm", "antioxidant", "jet lag", "insomnia"]
  },
  "dsip": {
    aliases: ["Delta Sleep-Inducing Peptide", "sleep peptide"],
    studied_for: ["deep sleep", "insomnia", "stress reduction", "sleep quality", "pain relief", "LH regulation"]
  },
  "vip": {
    aliases: ["Vasoactive Intestinal Peptide", "Aviptadil"],
    studied_for: ["gut health", "mold toxicity", "CIRS", "anti-inflammatory", "bronchodilation", "pulmonary hypertension", "erectile dysfunction", "immune tolerance"]
  },
  "kpv": {
    aliases: ["alpha-MSH fragment", "Lys-Pro-Val"],
    studied_for: ["anti-inflammatory", "gut healing", "Candida", "IBD", "psoriasis", "mast cell stabilization", "skin healing", "ulcerative colitis"]
  },
  "b12": {
    aliases: ["Cyanocobalamin", "Methylcobalamin", "cobalamin"],
    studied_for: ["energy boost", "nerve health", "metabolism", "red blood cell production", "fatigue", "neuropathy"]
  },
  "glutathione": {
    aliases: ["master antioxidant", "GSH"],
    studied_for: ["liver detox", "skin lightening", "immune support", "oxidative stress", "anti-aging", "cellular repair"]
  },
  "l-carnitine": {
    aliases: ["levocarnitine", "ALCAR"],
    studied_for: ["fat transport", "fat burning", "energy production", "mitochondrial support", "weight loss", "athletic performance"]
  },
  "lipo-c": {
    aliases: ["lipotropic", "MIC injection", "methionine inositol choline"],
    studied_for: ["fat burning", "liver detox", "weight loss", "energy boost", "metabolism"]
  },
  "lemon-bottle": {
    aliases: ["fat dissolving", "lipolysis", "spot reduction"],
    studied_for: ["double chin", "body contouring", "localized fat loss", "non-surgical liposuction"]
  },
  "glow": {
    aliases: ["skin health", "beauty", "collagen blend"],
    studied_for: ["skin radiance", "anti-aging", "hair and nails"]
  },
  "klow": {
    aliases: ["cosmetic", "beauty"],
    studied_for: ["skin health", "anti-aging"]
  },
  "thymalin": {
    aliases: ["thymus extract", "thymic bioregulator"],
    studied_for: ["immune regulation", "anti-aging", "T-cell function", "longevity", "viral infections", "immune restoration"]
  },
  "hcg": {
    aliases: ["Human Chorionic Gonadotropin", "pregnyl"],
    studied_for: ["testosterone production", "fertility", "PCT", "post cycle therapy", "weight loss", "cryptorchidism"]
  },
  "hmg": {
    aliases: ["Human Menopausal Gonadotropin", "menotropins"],
    studied_for: ["fertility", "spermatogenesis", "LH/FSH", "FSH", "testicular function"]
  },
  "oxytocin": {
    aliases: ["cuddle hormone", "pitocin"],
    studied_for: ["bonding", "social anxiety", "autism research", "stress reduction", "libido", "wound healing"]
  },
  "follistatin": {
    aliases: ["FST-344", "FST344", "myostatin inhibitor"],
    studied_for: ["muscle growth", "hypertrophy", "bodybuilding", "muscle wasting", "sarcopenia"]
  },
  "snap-8": {
    aliases: ["botox alternative", "anti-wrinkle", "argireline analog", "acetyl octapeptide-3"],
    studied_for: ["skin smoothing", "cosmetic", "expression lines", "wrinkle reduction"]
  },
  "igf-1-lr3": {
    aliases: ["Insulin-like Growth Factor 1 Long Arg3", "IGF1-LR3", "IGF1 LR3"],
    studied_for: ["muscle hyperplasia", "site enhancement", "anabolic", "muscle growth", "recovery", "anti-aging"]
  },
  "sermorelin": {
    aliases: ["GHRH", "GRF 1-29", "geref"],
    studied_for: ["anti-aging", "growth hormone secretagogue", "sleep improvement", "vitality", "body composition", "pituitary health"]
  },
  "ghrp-2": {
    aliases: ["Pralmorelin", "GHRP2", "GHRP 2"],
    studied_for: ["growth hormone secretagogue", "appetite stimulation", "muscle growth", "recovery", "anti-aging"]
  },
  "ghrp-6": {
    aliases: ["hunger peptide", "GHRP6", "GHRP 6"],
    studied_for: ["appetite stimulation", "growth hormone secretagogue", "gastric motility", "muscle growth", "recovery"]
  },
  "hexarelin": {
    aliases: ["cardioprotective GHRP", "examorelin"],
    studied_for: ["growth hormone secretagogue", "muscle growth", "heart health", "cardiac protection", "ischemia"]
  },
  "nad-plus": {
    aliases: ["Nicotinamide Adenine Dinucleotide", "NAD+", "NAD"],
    studied_for: ["energy production", "anti-aging", "longevity", "mitochondrial function", "sirtuin activator", "addiction recovery", "brain fog"]
  },
  "foxo4-dri": {
    aliases: ["senolytic", "anti-aging", "proxofim"],
    studied_for: ["cellular senescence", "longevity", "apoptosis of damaged cells", "healthspan extension", "hair regrowth", "frailty"]
  },
  "ll-37": {
    aliases: ["antimicrobial peptide", "cathelicidin", "LL37"],
    studied_for: ["antibacterial", "antiviral", "biofilm disruption", "immune support", "gut infections", "wound healing", "Lyme disease", "autoimmune"]
  },
  "ara-290": {
    aliases: ["Cibinetide", "erythropoietin derivative", "ARA290"],
    studied_for: ["neuropathy", "nerve pain", "anti-inflammatory", "tissue repair", "small fiber neuropathy", "sarcoidosis", "diabetic neuropathy"]
  },
  "bpc-tb": {
    aliases: ["healing blend", "wolverine blend", "BPC-157/TB-500", "repair blend"],
    studied_for: ["tissue repair", "joint healing", "recovery", "muscle tear", "inflammation", "systemic healing"]
  },
  "cjc-ipamorelin": {
    aliases: ["muscle growth blend", "anti-aging blend", "fat loss blend", "GH secretagogue blend", "CJC/Ipa"],
    studied_for: ["muscle growth", "fat loss", "anti-aging", "deep sleep", "recovery", "vitality"]
  },
  "cagrisema": {
    aliases: ["cagrilintide + semaglutide", "weight loss blend", "obesity blend"],
    studied_for: ["obesity", "appetite suppression", "extreme weight loss", "metabolic control"]
  },
  "bac-water": {
    aliases: ["Bacteriostatic Water", "reconstitution", "diluent", "sterile water with benzyl alcohol", "preservative", "bac water", "bact water"],
    studied_for: ["peptide reconstitution", "injection preparation", "sterile dilution", "vial prep"]
  },
  "acetic-acid": {
    aliases: ["0.6% acetic acid", "diluent", "IGF-1 reconstitution", "sterile solvent"],
    studied_for: ["peptide reconstitution", "acidic dilution", "IGF-1 LR3 prep"]
  }
};

const migrationRows: string[] = [];

for (const c of data) {
  const ex = expansions[c.slug];
  if (!ex) continue;
  
  // Merge, dedupe, and normalize
  const newAliases = Array.from(new Set([...(c.aliases || []), ...ex.aliases]));
  const newStudiedFor = Array.from(new Set([...(c.studied_for || []), ...ex.studied_for]));
  
  // Create PostgreSQL array literals. Escape single quotes by doubling them, 
  // and escape double quotes for the array elements.
  const formatArray = (arr: string[]) => {
    const joined = arr.map(s => s.replace(/"/g, '\\"')).join('","');
    const pgArray = `{"${joined}"}`;
    return `'${pgArray.replace(/'/g, "''")}'`;
  };
  
  const sql = `UPDATE public.compounds SET aliases = ${formatArray(newAliases)}, studied_for = ${formatArray(newStudiedFor)} WHERE slug = '${c.slug.replace(/'/g, "''")}';`;
  migrationRows.push(sql);
}

const migrationContent = `-- Migration to deeply optimize search terms for all compounds
-- Adds hundreds of layman's terms, synonyms, misspellings, and expanded studied_for pathways.

${migrationRows.join('\n')}
`;

const timestamp = '20260604231715'; // Keep the same timestamp so we overwrite it
fs.writeFileSync(`supabase/migrations/${timestamp}_optimize_compounds_search.sql`, migrationContent);
console.log(`Generated migration: supabase/migrations/${timestamp}_optimize_compounds_search.sql`);
