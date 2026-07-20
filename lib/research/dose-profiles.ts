/**
 * Dose & Frequency Profiles — Research Reference Only
 *
 * Data sourced from peer-reviewed literature, published clinical trial
 * protocols, and established research conventions. All values represent
 * ranges observed in preclinical / early-phase research contexts.
 *
 * ⚠️ FOR RESEARCH REFERENCE ONLY — NOT MEDICAL ADVICE.
 * These compounds are supplied for in vitro laboratory research use only.
 * Not intended for human or animal consumption, ingestion, or injection.
 */

export interface DoseProfile {
  typicalDose: string;
  frequency: string;
  cycleOn: string;
  cycleOff: string;
  routes: string[];
  notes: string;
}

/** Map of compound slug → DoseProfile */
export const DOSE_PROFILES: Record<string, DoseProfile> = {

  'bpc-157': {
    typicalDose: '250–500 mcg',
    frequency: 'Once or twice daily',
    cycleOn: '4–12 weeks',
    cycleOff: '4 weeks (equal to or half of on-cycle)',
    routes: ['Subcutaneous', 'Intramuscular', 'Oral (systemic effect reduced)'],
    notes: 'Most research protocols split the daily dose into AM/PM injections near the site of injury. Oral administration studied for gut-related research at higher doses (1–10 mcg/kg in rodent models). Stable in solution for up to 7 days at 4°C.',
  },

  'tb-500': {
    typicalDose: '2.0–2.5 mg (loading); 1.0–1.5 mg (maintenance)',
    frequency: 'Twice weekly (loading); once weekly (maintenance)',
    cycleOn: '4–6 weeks loading + ongoing maintenance as needed',
    cycleOff: '4–8 weeks after maintenance phase',
    routes: ['Subcutaneous', 'Intramuscular'],
    notes: 'Research protocols typically use a higher-dose loading phase for 4–6 weeks, then drop to maintenance frequency. Often stacked with BPC-157 in tissue repair research.',
  },

  'semaglutide': {
    typicalDose: '0.25 mg → titrated up to 2.4 mg (obesity research); 0.5–1 mg (metabolic research)',
    frequency: 'Once weekly',
    cycleOn: '68 weeks (per STEP trial protocol); ongoing in metabolic studies',
    cycleOff: 'No standardized off-cycle; weight regain observed on discontinuation in trials',
    routes: ['Subcutaneous'],
    notes: 'Titration is critical: 0.25 mg/week × 4 weeks → 0.5 mg/week × 4 weeks → 1 mg/week × 4 weeks → up to 2.4 mg/week. GI side effects are dose-dependent. Half-life ~168 hours (1 week) allows once-weekly dosing.',
  },

  'tirzepatide': {
    typicalDose: '2.5 mg → titrated up to 15 mg (SURMOUNT protocol)',
    frequency: 'Once weekly',
    cycleOn: '72 weeks (per SURMOUNT-1 protocol)',
    cycleOff: 'No standardized off-cycle in published research',
    routes: ['Subcutaneous'],
    notes: 'Titrate: 2.5 mg/week × 4 weeks → increase by 2.5 mg every 4 weeks to target dose. Dual GIP/GLP-1 agonism produces distinct metabolic profile vs. semaglutide alone. Administration once weekly on same day each week.',
  },

  'retatrutide': {
    typicalDose: '2 mg → titrated to 12 mg (Phase 2 TRIUMPH protocol)',
    frequency: 'Once weekly',
    cycleOn: '36–48 weeks (per Phase 2 trials)',
    cycleOff: 'Not yet established (compound in active clinical trials)',
    routes: ['Subcutaneous'],
    notes: 'Triple agonist (GLP-1/GIP/glucagon). Phase 2 data showed dose-dependent weight loss up to ~24% at 48 weeks. Titration: 2 mg × 4 weeks → 4 mg × 4 weeks → increase to target. Nausea most common at escalation.',
  },

  'sermorelin': {
    typicalDose: '200–500 mcg',
    frequency: 'Once daily, typically before sleep',
    cycleOn: '3–6 months',
    cycleOff: '1–2 months (or pulse protocol: 5 days on / 2 days off)',
    routes: ['Subcutaneous'],
    notes: 'GHRH analogue. Pulsatile dosing before sleep aligns with endogenous GH release cycles. Longer cycles (6 months) used in anti-aging research. Efficacy increases when combined with GHRP agents (ipamorelin, GHRP-2/6).',
  },

  'ipamorelin': {
    typicalDose: '100–300 mcg',
    frequency: '1–3 times daily (most research: twice daily — AM and before sleep)',
    cycleOn: '8–12 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous'],
    notes: 'Highly selective GH secretagogue with minimal cortisol/prolactin effect. Best administered on an empty stomach (2 hours post-meal). Frequently combined with CJC-1295 No-DAC for synergistic GHRH + GHRP pulse.',
  },

  'cjc-1295-no-dac': {
    typicalDose: '100–200 mcg per injection',
    frequency: '1–3 times daily (matching ipamorelin pulses)',
    cycleOn: '8–12 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous'],
    notes: 'Short half-life (~30 min). Designed to mimic endogenous GHRH pulse. Best used in combination with GHRP agents. Each injection creates a discrete GH pulse. Do not co-administer glucose; high blood sugar blunts GH release.',
  },

  'cjc-1295-dac': {
    typicalDose: '1–2 mg per week',
    frequency: 'Once or twice weekly',
    cycleOn: '8–12 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous', 'Intramuscular'],
    notes: 'DAC (Drug Affinity Complex) extends half-life to 6–8 days via albumin binding, creating sustained GH elevation (GH bleed) rather than discrete pulses. This blunted pulsatility is a key mechanistic distinction from No-DAC. Some protocols use 500 mcg twice weekly.',
  },

  'cjc-ipamorelin': {
    typicalDose: '100–200 mcg CJC-1295 No-DAC + 100–200 mcg Ipamorelin (pre-mixed or co-administered)',
    frequency: '1–2 times daily (AM and/or pre-sleep)',
    cycleOn: '8–12 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous'],
    notes: 'The combination leverages GHRH (CJC) + GHRP (Ipamorelin) synergy to maximize pulsatile GH release. Administer on an empty stomach. Pre-sleep administration preferred to align with endogenous GH secretion rhythms.',
  },

  'pt-141': {
    typicalDose: '0.5–2 mg',
    frequency: '1–2 hours before desired effect; not more than once per 72 hours',
    cycleOn: 'As-needed (not a daily protocol compound)',
    cycleOff: 'Minimum 72-hour gap between administrations',
    routes: ['Subcutaneous', 'Intranasal (research context)'],
    notes: 'MC4R agonist. Research doses start at 0.5 mg with titration to effect. Nausea is dose-dependent. Not administered more than 2–3 times per week in research protocols. Spontaneous erection and flushing are dose-dependent effects in rodent/primate models.',
  },

  'ghk-cu': {
    typicalDose: '1–2 mg (injectable); 0.5–2% topical concentration',
    frequency: 'Injectable: once daily or every other day. Topical: twice daily.',
    cycleOn: '4–8 weeks injectable; ongoing topical',
    cycleOff: '4 weeks (injectable); no required off-cycle (topical)',
    routes: ['Subcutaneous', 'Topical'],
    notes: 'Copper tripeptide. Topical research focuses on collagen stimulation and wound healing. Injectable protocols target systemic anti-inflammatory and tissue remodeling effects. Stability: reconstituted solution stable 2–4 weeks at 4°C.',
  },

  'ahk-cu': {
    typicalDose: '1–2 mg',
    frequency: 'Once daily or every other day',
    cycleOn: '4–8 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous', 'Topical'],
    notes: 'Alanine-Histidine-Lysine copper complex. Hair follicle and collagen research analog to GHK-Cu. Topical concentrations of 0.5–2% used in dermatology research. Less studied than GHK-Cu systemically.',
  },

  'epithalon': {
    typicalDose: '5–10 mg per day',
    frequency: 'Once daily for course duration',
    cycleOn: '10–20 days (course)',
    cycleOff: '4–6 months between courses',
    routes: ['Subcutaneous', 'Intramuscular', 'Intranasal'],
    notes: 'Telomerase activator tetrapeptide. Research protocols (Khavinson et al.) use short intensive courses (10–20 days) 1–2× per year rather than continuous dosing. Intranasal route studied for bioavailability at 2–4 mg per dose.',
  },

  'glutathione': {
    typicalDose: '600–1200 mg (IV/IM); 200–500 mg (subcutaneous)',
    frequency: '2–3 times per week (IV/IM); daily (subcutaneous)',
    cycleOn: '4–8 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Intravenous', 'Intramuscular', 'Subcutaneous', 'Nebulized'],
    notes: 'Master antioxidant. IV route provides highest bioavailability. Subcutaneous is less bioavailable but more practical. Oral supplementation has poor absorption. Nebulized form researched for pulmonary oxidative stress. IV push should be slow (over 5–10 minutes).',
  },

  'thymosin-alpha-1': {
    typicalDose: '1.6 mg',
    frequency: 'Twice weekly (standard protocol); daily (intensive immune research)',
    cycleOn: '6–12 weeks',
    cycleOff: '4–8 weeks',
    routes: ['Subcutaneous'],
    notes: 'FDA-approved as Zadaxin in some markets. Primary research areas: immune modulation, hepatitis, cancer adjuvant. The 1.6 mg × 2/week dose is derived directly from clinical trial protocols. Longer protocols (6 months) used in chronic viral infection research.',
  },

  'ss-31': {
    typicalDose: '2–4 mg/kg (rodent models); typical human-equivalent: 0.05–0.25 mg/kg',
    frequency: 'Once daily (or infusion in some cardiac research protocols)',
    cycleOn: '4–8 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous', 'Intravenous (research infusion)'],
    notes: 'Mitochondria-targeted antioxidant peptide (Szeto-Schiller peptide). Most cardiac and mitochondrial research uses IV infusion at controlled rates. Subcutaneous used for chronic dosing research. Human-equivalent doses derived from allometric scaling of published rodent data.',
  },

  'selank': {
    typicalDose: '250–500 mcg',
    frequency: 'Once or twice daily',
    cycleOn: '2–4 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Intranasal', 'Subcutaneous'],
    notes: 'Anxiolytic heptapeptide. Intranasal route (2–3 drops per nostril) is primary research route due to excellent CNS penetration. Short half-life requires twice-daily dosing for sustained effect. No observed withdrawal or dependency in research.',
  },

  'semax': {
    typicalDose: '200–600 mcg (intranasal); 100–300 mcg (subcutaneous)',
    frequency: 'Once or twice daily',
    cycleOn: '2–4 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Intranasal', 'Subcutaneous'],
    notes: 'ACTH/MSH analogue with nootropic and neuroprotective properties. Intranasal is preferred route (3–4 drops per nostril). Cognitive enhancement research typically uses 10–14 day courses. Higher doses (600 mcg intranasal) used in acute neuroprotection research.',
  },

  'cerebrolysin': {
    typicalDose: '5–30 mL per infusion (clinical); 1–5 mL subcutaneous (research adaptation)',
    frequency: 'Daily for course duration (IV); every other day (subcutaneous research)',
    cycleOn: '10–28 day courses',
    cycleOff: '1–3 months between courses',
    routes: ['Intravenous (slow infusion)', 'Intramuscular', 'Subcutaneous'],
    notes: 'Complex peptide mixture. Clinical IV protocols use 10–20 mL daily over 21–28 days for neurorehabilitation. Lower-dose IM/SC adaptations used in research settings. IV must be infused slowly (500 mL saline over 60 min or more). Never inject undiluted IV.',
  },

  'foxo4-dri': {
    typicalDose: '1–5 mg/kg (rodent models)',
    frequency: '3× per week (Monday/Wednesday/Friday protocol from Baar et al. 2017)',
    cycleOn: '3 weeks (per original research protocol)',
    cycleOff: 'Evaluated at 14+ days post-cycle for persistent effects',
    routes: ['Intraperitoneal (rodent)', 'Subcutaneous (adapted)'],
    notes: 'D-amino acid retro-inverso peptide targeting FOXO4-p53 interaction in senescent cells. The landmark Baar et al. (2017) Nature Medicine protocol used IP injection in mice at 5 mg/kg 3×/week for 3 weeks. Human-equivalent dosing not established in published literature.',
  },

  'kpv': {
    typicalDose: '100–500 mcg',
    frequency: 'Once or twice daily',
    cycleOn: '4–8 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Subcutaneous', 'Oral (for gut-localized research)', 'Topical'],
    notes: 'C-terminal MSH tripeptide (Lys-Pro-Val). Anti-inflammatory research focuses on IBD, skin inflammation, and wound healing. Oral route studied for gut-localized effects. Topical preparations at 0.5–1% for skin inflammation research.',
  },

  'll-37': {
    typicalDose: '0.5–2 mg',
    frequency: 'Once daily to every other day',
    cycleOn: '4–8 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous', 'Topical', 'Inhalation (pulmonary research)'],
    notes: 'Human cathelicidin antimicrobial peptide. Antimicrobial, immunomodulatory, and wound-healing research. High doses may be pro-inflammatory. Topical formulations at 0.1–1% for wound care research. Stability is relatively poor; use immediately after reconstitution.',
  },

  'igf-1-lr3': {
    typicalDose: '20–100 mcg',
    frequency: 'Once daily',
    cycleOn: '4 weeks maximum (due to receptor desensitization)',
    cycleOff: 'Minimum 4–6 weeks off for receptor recovery',
    routes: ['Subcutaneous', 'Intramuscular'],
    notes: 'Long R3 analogue with 60–120× longer half-life than native IGF-1. Extended half-life increases hypoglycemia risk. Most research protocols stay at or below 50 mcg/day. Administer post-workout in muscle research contexts. 4-week maximum cycle enforced in most protocols due to receptor downregulation.',
  },

  'follistatin': {
    typicalDose: '50–200 mcg (subcutaneous research)',
    frequency: 'Once daily for cycle duration',
    cycleOn: '10–30 days',
    cycleOff: '60–90 days (myostatin rebounds on discontinuation)',
    routes: ['Subcutaneous', 'Intramuscular'],
    notes: 'Follistatin-344 (truncated). Potent myostatin inhibitor; anabolic research uses short, intensive cycles. Extended use may produce permanent muscle fiber changes. Receptor downregulation studied in long-term rodent protocols. Extremely expensive and stability-sensitive.',
  },

  'oxytocin': {
    typicalDose: '10–40 IU (intranasal)',
    frequency: 'Once daily or as-needed (behavioral research)',
    cycleOn: '4 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Intranasal', 'Subcutaneous', 'Intravenous'],
    notes: 'Social bonding and anxiolytic research. Intranasal is primary route for CNS research (10–40 IU per session). IV used in labor research (highly dose-dependent). Subcutaneous used in some metabolic/pain research. Avoid chronic high-dose use — receptor desensitization observed.',
  },

  'tesamorelin': {
    typicalDose: '1–2 mg',
    frequency: 'Once daily',
    cycleOn: '12–26 weeks (FDA-approved HIV lipodystrophy protocol: 26 weeks)',
    cycleOff: '12 weeks minimum; effects attenuate after discontinuation',
    routes: ['Subcutaneous'],
    notes: 'GHRH analogue. FDA-approved as Egrifta for HIV-associated lipodystrophy at 2 mg/day. GH/IGF-1 levels normalize within 4–12 weeks. GH-stimulating effects cease on discontinuation; visceral fat reduction reverses within 12 weeks of stopping.',
  },

  'aod9604': {
    typicalDose: '250–500 mcg',
    frequency: 'Once daily (morning, fasted)',
    cycleOn: '8–12 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous'],
    notes: 'C-terminal HGH fragment (176–191). No IGF-1 raising effect. Lipolytic research uses fasted morning administration. Some protocols use twice-daily dosing at 250 mcg each injection. Previously studied in Phase II/III trials (Metabolic Pharmaceuticals).',
  },

  'hgh-fragment-176-191': {
    typicalDose: '250–500 mcg',
    frequency: 'Once or twice daily (fasted)',
    cycleOn: '8–12 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous'],
    notes: 'Identical to AOD-9604 in sequence; naming varies by supplier. Fasted state important — food blunts lipolytic effect. Split dosing (AM + pre-sleep) studied for prolonged lipolytic window. No androgenic or IGF-1 activity reported.',
  },

  'l-carnitine': {
    typicalDose: '500–2000 mg',
    frequency: 'Once or twice daily (pre-exercise in athletic research)',
    cycleOn: 'Ongoing (no established required off-cycle)',
    cycleOff: 'N/A — not required for this compound',
    routes: ['Subcutaneous', 'Intravenous', 'Oral'],
    notes: 'Mitochondrial fatty acid transport. IV route shows superior bioavailability for metabolic research. Oral supplementation well-studied. TMAO production from oral L-carnitine is a microbiome-dependent concern noted in cardiometabolic research.',
  },

  'melatonin': {
    typicalDose: '0.3–3 mg (physiological); up to 10 mg in antioxidant research',
    frequency: '30–60 minutes before sleep',
    cycleOn: 'Ongoing for sleep research; 4–8 weeks for antioxidant/anti-aging research',
    cycleOff: 'No strict off-cycle for low-dose use',
    routes: ['Oral', 'Subcutaneous (injectable for research)', 'Sublingual'],
    notes: 'Lower doses (0.3–0.5 mg) more accurately mimic endogenous levels. Higher doses (5–10 mg) used in antioxidant, neuroprotection, and cancer adjuvant research. Injectable forms used in circadian rhythm and oncology research settings.',
  },

  'dsip': {
    typicalDose: '25–50 mcg',
    frequency: 'Once nightly (sleep research); once every 3–5 days (stress research)',
    cycleOn: '2–4 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Subcutaneous', 'Intranasal', 'Intravenous'],
    notes: 'Delta Sleep-Inducing Peptide. Originally isolated from cerebral venous blood. Research uses very low doses. IV administration in original research (Schoenenberger et al.). Subcutaneous studied for sleep architecture effects. Minimal tolerance reported in rodent models.',
  },

  'mots-c': {
    typicalDose: '5–15 mg per week (rodent-derived; ~0.1 mg/kg)',
    frequency: '3–5 times per week in metabolic/exercise research',
    cycleOn: '4–8 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Subcutaneous', 'Intravenous'],
    notes: 'Mitochondrial-derived peptide. Exercise and metabolic research. Shown to improve insulin sensitivity and activate AMPK. Human dosing not established in published research — most data from IP/IV injection in rodents. Human-equivalent dosing estimated by allometric scaling.',
  },

  'mt-1': {
    typicalDose: '0.5–1 mg',
    frequency: 'Once daily (loading); 2–3 times/week (maintenance)',
    cycleOn: '2–4 weeks loading; ongoing maintenance',
    cycleOff: 'Tanning effect fades over 4–8 weeks post-cycle',
    routes: ['Subcutaneous'],
    notes: 'Melanotan I (afamelanotide). Linear ACTH/MSH analogue. FDA approved as Scenesse for erythropoietic protoporphyria. Research tanning protocols start at 0.5 mg to assess tolerance. Nausea common at higher doses. Melanocytes activated over 2–4 week period.',
  },

  'nad-plus': {
    typicalDose: '250–500 mg (IV infusion); 50–100 mg (subcutaneous)',
    frequency: 'IV: 3–5 times per week initially; SC: daily or every other day',
    cycleOn: '4–10 days intensive IV loading; then maintenance as needed',
    cycleOff: 'No strict off-cycle; loading courses repeated quarterly in research protocols',
    routes: ['Intravenous (slow infusion)', 'Subcutaneous', 'Intranasal'],
    notes: 'Nicotinamide adenine dinucleotide. IV must be infused very slowly (250 mg over 2–4 hours minimum) to avoid chest discomfort, flushing, and cramping. Subcutaneous administration avoids infusion discomfort. Intranasal provides CNS-targeted delivery for neuroprotection research.',
  },

  'ara-290': {
    typicalDose: '4 mg',
    frequency: 'Once daily for course duration',
    cycleOn: '28 days (per Phase 2 trial protocol; Brines et al.)',
    cycleOff: '4–8 weeks between courses',
    routes: ['Subcutaneous'],
    notes: 'Non-hematopoietic EPO peptide mimic. Research targets neuropathic pain, sarcoidosis-related small fiber neuropathy, and metabolic syndrome. The 4 mg × 28-day protocol derives from the first published human RCT (2014). No erythropoietic effects at this dose.',
  },

  'cagrilintide': {
    typicalDose: '0.3 mg → titrated to 4.5 mg (SCALE-NEXT trial protocol)',
    frequency: 'Once weekly',
    cycleOn: '32+ weeks (per active Phase 3 trials)',
    cycleOff: 'Not yet established (compound in active Phase 3 trials)',
    routes: ['Subcutaneous'],
    notes: 'Long-acting amylin analogue. In combination trials with semaglutide (CagriSema). Titration: 0.3 mg/week × 4 weeks → 0.6 mg/week → 1.2 mg/week → 2.4 mg/week → 4.5 mg/week. Nausea, vomiting most common during escalation.',
  },

  'cagrisema': {
    typicalDose: 'Cagrilintide 2.4 mg + Semaglutide 2.4 mg (co-formulated)',
    frequency: 'Once weekly',
    cycleOn: '68+ weeks (per REDEFINE Phase 3 trial)',
    cycleOff: 'Not yet established',
    routes: ['Subcutaneous'],
    notes: 'Fixed-ratio combination of cagrilintide + semaglutide under investigation by Novo Nordisk. Phase 2 data (2022) showed up to 15.6% weight loss at 32 weeks. Phase 3 REDEFINE program ongoing. Dose-limiting nausea/vomiting addressed via slow titration.',
  },

  'survodutide': {
    typicalDose: '0.6 mg → titrated to 6 mg (BOCES2/OASIS Phase 2 protocols)',
    frequency: 'Once weekly',
    cycleOn: '46 weeks (per BOCES-2 trial)',
    cycleOff: 'Not yet established',
    routes: ['Subcutaneous'],
    notes: 'Glucagon/GLP-1 dual agonist (BI 456906, Boehringer/Zealand). Titration over 16–20 weeks to maintenance dose. Phase 2 NASH data showed significant liver fat reduction. Once-weekly administration on same day each week.',
  },

  'aicar': {
    typicalDose: '250–500 mg',
    frequency: 'Once daily',
    cycleOn: '4–8 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous', 'Intravenous (research infusion at 500 mg/kg in rodents)'],
    notes: 'AMPK activator (5-aminoimidazole-4-carboxamide ribonucleotide). Endurance and metabolic research. Rodent research used very high doses (500 mg/kg IP) — human-equivalent subcutaneous doses far lower. WADA-prohibited substance; research-only context only.',
  },

  '5-amino-1mq': {
    typicalDose: '50–100 mg',
    frequency: 'Once or twice daily',
    cycleOn: '4–8 weeks',
    cycleOff: '4 weeks',
    routes: ['Oral (primarily)', 'Subcutaneous (research adaptation)'],
    notes: 'NNMT (nicotinamide N-methyltransferase) inhibitor. Metabolic and obesity research. Oral bioavailability makes it suitable for research supplementation. Shown to reduce adiposity and increase NAD+ in rodent models. Human dosing extrapolated from allometric scaling.',
  },

  'thymalin': {
    typicalDose: '5–10 mg per day',
    frequency: 'Once daily for course duration',
    cycleOn: '10 days (standard course, Khavinson protocol)',
    cycleOff: '3–6 months between courses (1–2 courses per year)',
    routes: ['Intramuscular', 'Subcutaneous'],
    notes: 'Thymic peptide complex (bovine thymus extract). Russian gerontology research (Khavinson). Typical protocol: 5–10 mg/day × 10 days, 1–2 times per year. Immune modulation and longevity research. Often co-administered with Epithalon in longevity research protocols.',
  },

  'vip': {
    typicalDose: '50–100 pmol/kg/min (IV infusion in research); 0.1–1 mcg intranasal',
    frequency: 'Intranasal: 2–3 times daily. IV: continuous infusion in research settings.',
    cycleOn: '2–4 weeks (intranasal research)',
    cycleOff: '2–4 weeks',
    routes: ['Intranasal', 'Intravenous (infusion)', 'Subcutaneous'],
    notes: 'Vasoactive Intestinal Peptide. MCAS, inflammatory bowel, pulmonary hypertension, and CIRS research. Very short plasma half-life (~2 min). Intranasal routes used for CNS and mucosal delivery. IV infusion for systemic vasodilatory research. Flushing and hypotension at higher IV doses.',
  },

  'b12': {
    typicalDose: '500–1000 mcg (cyanocobalamin or methylcobalamin)',
    frequency: 'Once daily (deficiency research); once weekly (maintenance)',
    cycleOn: 'Ongoing (repleted as needed based on serum levels)',
    cycleOff: 'N/A — essential nutrient supplementation',
    routes: ['Subcutaneous', 'Intramuscular', 'Sublingual (oral research)'],
    notes: 'IM injection provides highest bioavailability (bypasses intrinsic factor). Subcutaneous comparable to IM for cobalamin. Methylcobalamin preferred for neurological research. Cyanocobalamin lowest cost; hydroxocobalamin longest retention. Serum B12 monitoring recommended in research protocols.',
  },

  'ghrp-2': {
    typicalDose: '100–300 mcg',
    frequency: '2–3 times daily (fasted state preferred)',
    cycleOn: '8–12 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous', 'Intranasal'],
    notes: 'Potent GH secretagogue. Stimulates ghrelin receptor. Notably increases cortisol and prolactin more than ipamorelin — a key distinction. Administration on empty stomach maximizes GH pulse amplitude. Often combined with GHRH peptides (sermorelin, CJC-1295 No-DAC).',
  },

  'ghrp-6': {
    typicalDose: '100–300 mcg',
    frequency: '2–3 times daily (fasted state)',
    cycleOn: '8–12 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous'],
    notes: 'Original hexapeptide GHRP. Strong appetite stimulation is a key effect — appetite increase observed 20–30 min post-injection. Gastric motility effects studied (gastroparesis research). More hunger stimulation than GHRP-2 or ipamorelin. Cortisol and prolactin elevations reported.',
  },

  'hexarelin': {
    typicalDose: '100–200 mcg',
    frequency: '1–3 times daily',
    cycleOn: '4–8 weeks (desensitization occurs faster than other GHRPs)',
    cycleOff: '4+ weeks for receptor recovery',
    routes: ['Subcutaneous'],
    notes: 'Most potent GHRP by GH-releasing activity. Fastest receptor desensitization among GHRPs — shorter effective cycles required. Cardioprotective effects studied independently of GH axis (direct GHS-R1b-mediated). Prolactin and cortisol elevations are significant.',
  },

  'kisspeptin-10': {
    typicalDose: '0.01–10 nmol/kg (research IV); 1–3 mg subcutaneous (clinical research)',
    frequency: 'IV: pulsatile infusion (90-min pulses). SC: once or twice daily.',
    cycleOn: '4–8 weeks (LH axis research)',
    cycleOff: '4 weeks',
    routes: ['Intravenous (infusion)', 'Subcutaneous'],
    notes: 'GPR54/KISS1R agonist. Potent LH/FSH stimulator via GnRH axis. Research in hypogonadism, fertility, and sexual dysfunction. Pulsatile delivery preserves LH pulsatility; continuous infusion can paradoxically suppress due to receptor desensitization.',
  },

  'pinealon': {
    typicalDose: '5–10 mg per day',
    frequency: 'Once daily for course duration',
    cycleOn: '10 days (standard Khavinson course)',
    cycleOff: '3–6 months between courses',
    routes: ['Intranasal', 'Sublingual', 'Subcutaneous'],
    notes: 'Tripeptide (Ala-Glu-Asp) from pineal gland research (Khavinson). Neuroprotection and cognitive longevity research. Short intensive courses 1–2× per year. Intranasal route preferred for CNS penetration. Often co-administered with Epithalon and Cortagen in longevity stacks.',
  },

  'snap-8': {
    typicalDose: 'Topical only: 3–8% concentration in formulation',
    frequency: 'Twice daily topical application',
    cycleOn: 'Ongoing with topical use',
    cycleOff: 'No required off-cycle',
    routes: ['Topical'],
    notes: 'Octapeptide (Acetyl Glutamyl Heptapeptide-3). Anti-wrinkle research targeting neuromuscular junction signal reduction. No injectable research protocols — cosmeceutical application only. 3–8% concentration in serum or cream vehicles. Works synergistically with Argireline (Acetyl Hexapeptide-3).',
  },

  'hcg': {
    typicalDose: '250–1000 IU (male fertility/HPG axis research); 500–2000 IU (luteal phase support)',
    frequency: '3× per week (HPG maintenance); every 3–5 days (fertility research)',
    cycleOn: '8–12 weeks HPG research; per-cycle (fertility)',
    cycleOff: '4+ weeks',
    routes: ['Subcutaneous', 'Intramuscular'],
    notes: 'Human Chorionic Gonadotropin. LH mimetic. Male research: 250–500 IU 3×/week maintains testicular function. Higher doses (1000–2000 IU 3×/week) for testicular recovery research. Aromatization to estrogen increases at higher doses — relevant for research modeling.',
  },

  'hmg': {
    typicalDose: '75–150 IU per injection',
    frequency: '3 times per week or daily (fertility research protocols)',
    cycleOn: 'Cycle-dependent (fertility protocol: 3–6 weeks)',
    cycleOff: 'Per-cycle (not continuous)',
    routes: ['Subcutaneous', 'Intramuscular'],
    notes: 'Human Menopausal Gonadotropin (LH + FSH activity). Fertility and HPG axis research. FSH component stimulates spermatogenesis and folliculogenesis. Often combined with HCG in male fertility research. Dose titrated to response in clinical research settings.',
  },

  'lemon-bottle': {
    typicalDose: '0.5–1 mL per treatment area',
    frequency: 'Once every 3–4 weeks per session',
    cycleOn: '3–6 sessions per treatment area',
    cycleOff: 'Reassess after treatment series completion',
    routes: ['Subcutaneous injection (mesotherapy)'],
    notes: 'Lipolytic injection cocktail (contains phosphatidylcholine, deoxycholic acid, riboflavin, bromelain, lecithin). Mesotherapy protocol for localized fat reduction research. Injected directly into subcutaneous fat. Bruising, swelling, nodules common in 1–3 days post-injection.',
  },

  'lipo-c': {
    typicalDose: '1–2 mL per injection',
    frequency: '2–3 times per week',
    cycleOn: '6–8 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Subcutaneous', 'Intramuscular'],
    notes: 'Lipotropic compound cocktail (typically MIC: methionine, inositol, choline; often with B12 and/or L-carnitine). Weight management and liver health research. Each component supports hepatic fat metabolism. MIC components individually studied; combination synergy researched in weight management context.',
  },

  'ss-31': {
    typicalDose: '2–4 mg/kg (rodent models); ~0.05–0.25 mg/kg human-equivalent',
    frequency: 'Once daily subcutaneous; or IV infusion in cardiac research',
    cycleOn: '4–8 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous', 'Intravenous'],
    notes: 'See earlier entry — Szeto-Schiller peptide 31 (Elamipretide). Mitochondrial cardiolipin-targeting antioxidant. Phase 2 cardiac trials conducted by Stealth BioTherapeutics. IV infusion used in heart failure research.',
  },

  'bpc-tb': {
    typicalDose: 'BPC-157: 250 mcg + TB-500: 2 mg (pre-mixed or co-administered)',
    frequency: 'Once daily (BPC component) with twice-weekly (TB component) — or as pre-mixed blend twice weekly',
    cycleOn: '4–8 weeks',
    cycleOff: '4 weeks',
    routes: ['Subcutaneous', 'Intramuscular'],
    notes: 'Combination stack of BPC-157 and TB-500. Tissue repair research uses both peptides for synergistic angiogenesis, collagen synthesis, and actin cytoskeleton effects. Pre-mixed blends sold at 2:1 TB-500:BPC-157 ratio. Individual compound stacking allows independent dose titration.',
  },

  'glow': {
    typicalDose: 'Per product formulation',
    frequency: 'Per protocol',
    cycleOn: '4–8 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Subcutaneous'],
    notes: 'Proprietary blend. Refer to specific product composition for component-level dosing. Components typically include GHK-Cu, BPC-157, or similar skin/repair peptides at combined therapeutic research doses.',
  },

  'klow': {
    typicalDose: 'Per product formulation',
    frequency: 'Per protocol',
    cycleOn: '4–8 weeks',
    cycleOff: '2–4 weeks',
    routes: ['Subcutaneous'],
    notes: 'Proprietary blend. Refer to specific product composition for component-level dosing. Components typically include peptides targeting metabolic or anti-inflammatory pathways at combined research doses.',
  },

  'acetic-acid': {
    typicalDose: '0.6–0.9% (bacteriostatic acetic acid for reconstitution)',
    frequency: 'Used as reconstitution solvent — not dosed independently',
    cycleOn: 'N/A — reconstitution vehicle',
    cycleOff: 'N/A',
    routes: ['Reconstitution vehicle for lyophilized peptides'],
    notes: 'Used as an alternative to bacteriostatic water for reconstituting certain peptides (e.g., IGF-1, Follistatin) that are unstable in aqueous solutions without an acid vehicle. Typical concentration 0.6–0.9%. Not administered alone.',
  },

  'bac-water': {
    typicalDose: '1–3 mL per vial reconstitution (volume determines concentration)',
    frequency: 'Used once per reconstitution — not a stand-alone compound',
    cycleOn: 'N/A — reconstitution vehicle',
    cycleOff: 'N/A',
    routes: ['Reconstitution vehicle for lyophilized peptides'],
    notes: '0.9% benzyl alcohol in sterile water. Primary reconstitution vehicle for lyophilized peptides. Benzyl alcohol acts as bacteriostatic preservative, extending reconstituted peptide stability (typically 28–60 days at 4°C vs. 7 days for sterile water). Do not use for neonates.',
  },

};

/** Returns the dose profile for a compound slug, or null if not found. */
export function getDoseProfile(slug: string): DoseProfile | null {
  return DOSE_PROFILES[slug] ?? null;
}
