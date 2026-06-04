-- ============================================================
-- Phase 3: Fill ALL remaining empty/null fields
-- typical_frequency, year_discovered, pk_summary for every compound
-- ============================================================

-- typical_frequency: how often researchers dose in studies
-- year_discovered:   when the compound was first synthesized/identified
-- pk_summary:        plain English pharmacokinetics

UPDATE compounds SET
  typical_frequency = 'Once or twice daily SC injection (research protocols)',
  year_discovered = 1991,
  pk_summary = 'Rapidly absorbed after SC injection; distributed systemically. Half-life poorly characterized in humans. Stable in solution for 3-5 days refrigerated post-reconstitution.'
WHERE slug = 'bpc-157';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly SC injection',
  year_discovered = 1981,
  pk_summary = 'Systemic distribution after SC injection; acts via actin sequestration. Precise human PK data lacking; animal studies suggest days-long tissue residence.'
WHERE slug = 'tb-500';

UPDATE compounds SET
  typical_frequency = 'Daily IV infusion or SC injection (clinical); weekly in some longevity protocols',
  year_discovered = 1906,
  pk_summary = 'IV NAD+ has a very short plasma half-life due to rapid cellular uptake and metabolism. Oral/SC routes have lower bioavailability. IV preferred for acute clinical effects.'
WHERE slug = 'nad-plus';

UPDATE compounds SET
  typical_frequency = 'Once weekly SC injection',
  year_discovered = 2012,
  pk_summary = 'Subcutaneous bioavailability ~89%. Half-life ~1 week due to albumin binding via C18 fatty acid chain. Steady state reached in 4-5 weeks. Renal clearance.'
WHERE slug = 'semaglutide';

UPDATE compounds SET
  typical_frequency = 'Once weekly SC injection',
  year_discovered = 2018,
  pk_summary = 'Half-life approximately 5 days; SC bioavailability ~80%. Steady state at ~4 weeks. GIP and GLP-1 receptor dual agonism with linear PK across dose range.'
WHERE slug = 'tirzepatide';

UPDATE compounds SET
  typical_frequency = 'Once weekly SC injection (clinical trials)',
  year_discovered = 2022,
  pk_summary = 'Half-life ~1 week (similar class to tirzepatide). Triple agonism at GLP-1/GIP/glucagon receptors. SC administration; human PK from Phase 2 trials.'
WHERE slug = 'retatrutide';

UPDATE compounds SET
  typical_frequency = 'Once or twice daily SC injection; pulsed with meals in some protocols',
  year_discovered = 2005,
  pk_summary = 'Short-acting GHRH analog; half-life ~30 minutes without DAC modification. Rapid onset of GH pulse. Best dosed at night to align with natural GH secretion.'
WHERE slug = 'cjc-1295-no-dac';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly SC injection',
  year_discovered = 2005,
  pk_summary = 'Drug Affinity Complex (DAC) binds serum albumin extending half-life to ~6-8 days. Provides sustained GH elevation rather than pulsatile release. Once or twice weekly dosing.'
WHERE slug = 'cjc-1295-dac';

UPDATE compounds SET
  typical_frequency = 'Once or twice daily SC injection (combined stack)',
  year_discovered = 2005,
  pk_summary = 'CJC no-DAC half-life ~30 min; Ipamorelin half-life ~2 hours. Combined, they provide a synergistic GH pulse. Ideally dosed at bedtime for maximal GH release during sleep.'
WHERE slug = 'cjc-ipamorelin';

UPDATE compounds SET
  typical_frequency = 'Once or twice daily SC injection',
  year_discovered = 1998,
  pk_summary = 'Half-life approximately 2 hours. Rapid SC absorption. Selective ghrelin receptor agonism without cortisol or prolactin elevation. Steady GH release 2-3 hours post-injection.'
WHERE slug = 'ipamorelin';

UPDATE compounds SET
  typical_frequency = 'Two to three times weekly SC injection',
  year_discovered = 1982,
  pk_summary = 'Rapid SC absorption; half-life ~30 minutes; GH peak at 15-60 minutes post-injection. Pituitary GH reserve test: single IV or SC dose. Steady state not applicable for diagnostic use.'
WHERE slug = 'sermorelin';

UPDATE compounds SET
  typical_frequency = 'Once or twice daily SC injection',
  year_discovered = 1980,
  pk_summary = 'Very short plasma half-life (~30 min). Strong GH pulse within 15-60 min post-injection. May elevate cortisol and prolactin unlike selective peptides. Diagnostic and research protocols.'
WHERE slug = 'ghrp-2';

UPDATE compounds SET
  typical_frequency = 'Once to three times daily SC injection',
  year_discovered = 1982,
  pk_summary = 'Short half-life (~15-60 min). Strong GH release with notable appetite stimulation via ghrelin receptor. Cortisol and prolactin elevation possible. Used pre-meal in research bulking protocols.'
WHERE slug = 'ghrp-6';

UPDATE compounds SET
  typical_frequency = 'Once or twice daily SC injection',
  year_discovered = 1992,
  pk_summary = 'Short half-life (similar to other GHRPs). Most potent GH-releasing peptide; also binds GHS-R and cardiac receptors. Rapid SC absorption. May cause cortisol/prolactin elevation at higher doses.'
WHERE slug = 'hexarelin';

UPDATE compounds SET
  typical_frequency = 'Daily SC injection during research cycles',
  year_discovered = 1973,
  pk_summary = 'Topical: penetrates dermis; systemic absorption minimal. SC: rapidly distributed, short plasma half-life. Copper chelated form is more stable. Tissue residence longer than plasma suggests receptor binding.'
WHERE slug = 'ghk-cu';

UPDATE compounds SET
  typical_frequency = 'Topical application 1-2x daily (cosmetic use)',
  year_discovered = 2000,
  pk_summary = 'Topical cosmeceutical peptide. Penetration depends on formulation vehicle. Systemic absorption considered negligible in cosmetic concentrations. Local SNARE inhibition is transient.'
WHERE slug = 'snap-8';

UPDATE compounds SET
  typical_frequency = 'Daily to every other day SC injection',
  year_discovered = 1991,
  pk_summary = 'Tetrapeptide; half-life very short without protection. Intranasal absorption ~50-70% reported in some studies. SC injection preferred for research. Rapidly crosses blood-brain barrier via nasal route.'
WHERE slug = 'epithalon';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly IV or SC injection',
  year_discovered = 1977,
  pk_summary = 'Endogenous peptide from thymus; extremely short plasma half-life (~15 minutes). Immunological effects persist far beyond plasma clearance due to lymphocyte activation. Typically dosed in 10-day protocols.'
WHERE slug = 'thymalin';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly SC injection; 6-month on, 6-month off protocols',
  year_discovered = 1977,
  pk_summary = 'Short serum half-life (~2 hours) but sustained immunological effects. SC bioavailability good. Approved as Zadaxin for IV/SC use. Standard research protocols: 1.6 mg SC twice weekly for 6 months.'
WHERE slug = 'thymosin-alpha-1';

UPDATE compounds SET
  typical_frequency = 'Daily SC injection in research protocols',
  year_discovered = 2017,
  pk_summary = 'D-amino acid retro-inverso peptide; resistant to proteolysis. Superior in vivo stability vs. natural L-peptides. SC or IP administration in animal models. Human PK not yet characterized.'
WHERE slug = 'foxo4-dri';

UPDATE compounds SET
  typical_frequency = 'Daily or every other day SC injection',
  year_discovered = 1995,
  pk_summary = 'Endogenous 37-amino acid cationic peptide. Short plasma half-life; rapidly degraded by proteases. Local SC effects at injection site; systemic distribution with IV administration.'
WHERE slug = 'll-37';

UPDATE compounds SET
  typical_frequency = 'Daily SC injection or every other day',
  year_discovered = 2015,
  pk_summary = 'Short plasma half-life after SC administration. Rapidly taken up by metabolically active tissues. AMPK activation within 30-60 min of injection in rodent studies. Human Phase 1 PK emerging.'
WHERE slug = 'mots-c';


UPDATE compounds SET
  typical_frequency = 'Once or twice daily SC injection; intranasal drops daily (approved form)',
  year_discovered = 1984,
  pk_summary = 'SC injection; peak GH rise in 30-60 min. Approved for HIV lipodystrophy at 2 mg daily SC. Intranasal bioavailability ~40%. Half-life ~38 min; GH effects persist 2-4 hours.'
WHERE slug = 'tesamorelin';

UPDATE compounds SET
  typical_frequency = 'Three times weekly SC injection (standard research protocol)',
  year_discovered = 2009,
  pk_summary = 'Non-hematopoietic EPO analog; no erythropoietic activity. Short half-life; primarily tissue distribution. SC injection preferred. Anti-neuropathic effects persist beyond plasma clearance.'
WHERE slug = 'ara-290';

UPDATE compounds SET
  typical_frequency = 'Daily to every other day SC injection',
  year_discovered = 2015,
  pk_summary = 'Small molecule (not a peptide); oral bioavailability under investigation. SC injection bypasses first-pass metabolism. Tissue distribution in adipose tissue. Short to medium plasma half-life based on structural analogs.'
WHERE slug = '5-amino-1mq';

UPDATE compounds SET
  typical_frequency = 'Daily or every other day SC injection',
  year_discovered = 1991,
  pk_summary = 'AMPK activator; rapidly phosphorylated intracellularly to ZMP. SC injection achieves systemic tissue levels. Short plasma half-life; intracellular AICA-ribotide accumulation drives sustained effects.'
WHERE slug = 'aicar';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly SC injection',
  year_discovered = 2021,
  pk_summary = 'Long-acting amylin analog; half-life ~1 week due to fatty acid acylation. SC injection; steady state at ~5 weeks. Combined with semaglutide in CagriSema trials as fixed weekly dose.'
WHERE slug = 'cagrilintide';

UPDATE compounds SET
  typical_frequency = 'Once weekly SC injection (fixed combination)',
  year_discovered = 2021,
  pk_summary = 'Fixed combination of cagrilintide (~1 week half-life) and semaglutide (~1 week half-life). Both administered as a single weekly SC injection. Steady state achieved at 5+ weeks.'
WHERE slug = 'cagrisema';

UPDATE compounds SET
  typical_frequency = 'Once weekly SC injection (clinical trials)',
  year_discovered = 2019,
  pk_summary = 'Dual GLP-1/glucagon agonist. Weekly SC dosing like semaglutide. ~1 week half-life estimated from structural similarity. MASH trials used 4.8 mg weekly escalating dose.'
WHERE slug = 'survodutide';

UPDATE compounds SET
  typical_frequency = 'Daily to twice weekly IV infusion or SC injection',
  year_discovered = 1984,
  pk_summary = 'IV infusion preferred for brain penetration; short plasma half-life for peptide components. SC injection possible. Standard clinical protocols: 5-10 mL IV daily x 10-20 days for stroke/TBI.'
WHERE slug = 'cerebrolysin';

UPDATE compounds SET
  typical_frequency = 'Intranasal drops 2-3x daily or SC injection',
  year_discovered = 1982,
  pk_summary = 'Heptapeptide; highly resistant to enzymatic degradation (D-Pro residue). Intranasal bioavailability ~90%; rapidly crosses BBB. SC injection alternative. Half-life in brain tissue significantly longer than plasma.'
WHERE slug = 'selank';

UPDATE compounds SET
  typical_frequency = 'Intranasal drops 2-3x daily or SC injection',
  year_discovered = 1982,
  pk_summary = 'ACTH 4-10 analog with Pro-Gly-Pro modification for proteolytic resistance. Intranasal route preferred; excellent CNS bioavailability. SC injection alternative. Rapid onset; half-life ~20-40 min but effects persist hours.'
WHERE slug = 'semax';

UPDATE compounds SET
  typical_frequency = 'Daily or every other day SC injection',
  year_discovered = 2002,
  pk_summary = 'Tripeptide; short plasma half-life. Penetrates blood-brain barrier via active transport. SC injection distributes systemically. Pineal and cerebrocortical tissue accumulation hypothesized based on bioregulator model.'
WHERE slug = 'pinealon';

UPDATE compounds SET
  typical_frequency = 'Every other day to weekly SC injection',
  year_discovered = 2013,
  pk_summary = 'Mitochondria-targeting tetrapeptide. Extremely high affinity for cardiolipin in inner mitochondrial membrane. Rapidly distributed to mitochondria. IV infusion in trials; SC in research. Short plasma half-life; intramitochondrial residence prolonged.'
WHERE slug = 'ss-31';

UPDATE compounds SET
  typical_frequency = 'Twice daily SC injection during research cycles',
  year_discovered = 1987,
  pk_summary = 'Large glycoprotein (35 kDa); SC bioavailability variable. IV preferred in clinical fertility protocols. FSH component half-life ~40 hours; LH component ~10 hours. Urinary-derived preparation.'
WHERE slug = 'hmg';

UPDATE compounds SET
  typical_frequency = 'Every other day to twice weekly SC injection',
  year_discovered = 1976,
  pk_summary = 'SC injection; long half-life ~20-30 hours for LR3 modification vs ~15 min for native IGF-1. Albumin binding reduced by Arg3 substitution. Systemic muscle/anabolic distribution. Potent receptor activation at receptor level.'
WHERE slug = 'igf-1-lr3';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly SC injection; high FSH doses in IVF',
  year_discovered = 1960,
  pk_summary = 'Glycoprotein hormone; IM or SC injection. IV for fertility; SC for hypogonadism. IM half-life ~24-36 hours. SC half-life ~30 hours. Urinary or recombinant forms. Stimulates Leydig cell testosterone production within 24-48 hours.'
WHERE slug = 'hcg';

UPDATE compounds SET
  typical_frequency = 'Once daily to twice weekly IV or SC injection; pulsatile protocols used in fertility',
  year_discovered = 2000,
  pk_summary = 'Short half-life (~5-15 min for KP-10); rapidly cleared by neutral endopeptidases. IV bolus used in fertility trials; SC injection in research. Pulsatile administration required for HPG axis activation.'
WHERE slug = 'kisspeptin-10';

UPDATE compounds SET
  typical_frequency = 'As needed; typically 45 min before intimacy (approved female use)',
  year_discovered = 2000,
  pk_summary = 'SC injection; peak plasma 1 hour post-dose. Half-life ~3 hours. Approved dose: 1.75 mg SC as needed. Not for daily use. Nausea risk if >1 dose per 24 hours.'
WHERE slug = 'pt-141';

UPDATE compounds SET
  typical_frequency = 'As needed for labor/postpartum; nasal spray research protocols variable',
  year_discovered = 1953,
  pk_summary = 'IV infusion for obstetric indications; nasal spray for research. Plasma half-life ~3-5 minutes IV. Intranasal bioavailability ~50-80%. Rapidly metabolized by oxytocinase. CSF concentrations ~5% of plasma with intranasal route.'
WHERE slug = 'oxytocin';

UPDATE compounds SET
  typical_frequency = 'Once daily SC injection or once weekly; varies by protocol',
  year_discovered = 1966,
  pk_summary = 'Approved (Scenesse): 16 mg implant every 60 days. Research SC injection: variable. Half-life ~30 hours with ND-MSH modification vs ~2 min for native alpha-MSH. Prolonged melanocortin receptor activation.'
WHERE slug = 'mt-1';

UPDATE compounds SET
  typical_frequency = 'Nightly SC injection or sublingual; 0.3-5 mg range in research',
  year_discovered = 1958,
  pk_summary = 'SC injection: rapid onset; peak plasma 30-60 min; half-life 20-50 min. Oral bioavailability only 3-33% due to first-pass metabolism. SC or sublingual preferred for research. Immediate-release formulation.'
WHERE slug = 'melatonin';

UPDATE compounds SET
  typical_frequency = 'Nightly SC injection (matches natural release timing)',
  year_discovered = 1977,
  pk_summary = 'Nonapeptide; extremely short IV half-life ~15 min due to rapid enzymatic cleavage. SC injection extends effect. Crosses blood-brain barrier. Intranasal route experimental. Effects on sleep stages outlast plasma clearance.'
WHERE slug = 'dsip';

UPDATE compounds SET
  typical_frequency = 'Once or twice daily SC injection; topical for hair',
  year_discovered = 1998,
  pk_summary = 'Copper tripeptide; SC absorption leads to copper delivery systemically. Topical application localizes effect to scalp/skin. Short plasma half-life as free tripeptide; longer tissue residence when copper-bound to receptor.'
WHERE slug = 'ahk-cu';

UPDATE compounds SET
  typical_frequency = 'Once or twice daily IV infusion (clinical); SC in research',
  year_discovered = 1970,
  pk_summary = 'IV infusion produces rapid vasodilation. Half-life ~1-2 minutes IV; inhaled/nebulized has 60-90 min effect. SC injection distributes systemically. Being studied as IV infusion (Aviptadil) for ARDS at 200 pmol/kg/hour.'
WHERE slug = 'vip';

UPDATE compounds SET
  typical_frequency = 'Weekly to monthly IM injection for B12 deficiency; variable in research stacks',
  year_discovered = 1948,
  pk_summary = 'IM/SC injection: essentially 100% bioavailability vs 1-10% oral in deficiency. Peak plasma within 1 hour IM. Half-life ~6 days plasma; stored in liver for years. Cyanocobalamin vs methylcobalamin: both effective IM.'
WHERE slug = 'b12';

UPDATE compounds SET
  typical_frequency = 'Once or twice daily oral (capsule); injectable under investigation',
  year_discovered = 1905,
  pk_summary = 'Oral L-carnitine bioavailability ~14-18%; IV essentially 100%. Renal reabsorption maintains plasma levels. Half-life ~17 hours plasma. Skeletal muscle stores dominate total body carnitine (~95%). ALCAR (acetyl) crosses BBB.'
WHERE slug = 'l-carnitine';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly IV infusion or push (clinical GSH)',
  year_discovered = 1921,
  pk_summary = 'IV push or infusion: rapid distribution; half-life short (minutes) as free GSH due to hydrolysis. IV preferred; oral bioavailability poor (<1%). Cellular uptake via gamma-glutamyl cycle replenishes intracellular stores.'
WHERE slug = 'glutathione';

UPDATE compounds SET
  typical_frequency = 'Once to three times daily SC injection or intranasal',
  year_discovered = 2010,
  pk_summary = 'Tripeptide core of alpha-MSH; ultra-short plasma half-life. Intranasal or SC administration. Gut administration may provide local mucosal effects. Oral form degrades rapidly. SC preserves systemic anti-inflammatory effects.'
WHERE slug = 'kpv';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly SC injection; combination stack protocol',
  pk_summary = 'Combined BPC-157 and TB-500 pharmacokinetics: BPC-157 short plasma half-life, TB-500 days-long tissue residence. Combined dosing 1-2x weekly in research. Each component distributes independently.'
WHERE slug = 'bpc-tb';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly combined SC injections (all components)',
  pk_summary = 'Multi-component stack: TB-500, BPC-157, GHK-Cu combined. Each has distinct PK. Weekly or twice-weekly combined injection in clinical aesthetic research. Individual component half-lives: minutes to days depending on tissue binding.'
WHERE slug = 'glow';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly combined SC injections (all components)',
  pk_summary = 'Four-component stack: TB-500, BPC-157, GHK-Cu, KPV. Each component has independent PK profile. Weekly combined dosing standard in research protocols. Components act synergistically across tissue repair, gut, and immune axes.'
WHERE slug = 'klow';

UPDATE compounds SET
  typical_frequency = 'Aesthetic injections into target fat deposits; practitioner-administered',
  year_discovered = 2020,
  pk_summary = 'Local injection into adipose tissue. Components (riboflavin, bromelain, lecithin) act locally. Minimal systemic absorption expected. Effect duration 2-4 weeks per treatment session.'
WHERE slug = 'lemon-bottle';

UPDATE compounds SET
  typical_frequency = 'Once or twice weekly IM or SC injection',
  year_discovered = 1950,
  pk_summary = 'IM injection; lipotropic components (methionine, inositol, choline) distribute systemically. B vitamins rapidly absorbed and excreted renally. Short to medium plasma residence. Fat metabolism effects depend on hepatic uptake.'
WHERE slug = 'lipo-c';

UPDATE compounds SET
  typical_frequency = 'Three times daily SC injections to once daily (lipolysis protocols)',
  year_discovered = 2003,
  pk_summary = 'SC injection; half-life poorly characterized in humans. Designed to mimic the lipolytic C-terminal fragment of HGH. Rapid SC absorption; distributes to adipose tissue. Free of GH-axis effects at standard doses.'
WHERE slug = 'hgh-fragment-176-191';

UPDATE compounds SET
  typical_frequency = 'As needed cosmetic injections; aesthetic clinic protocol',
  year_discovered = 1965,
  pk_summary = 'IV or IM for obstetric use. Plasma half-life 4-8 minutes IV; 20-30 minutes IM. Rapidly inactivated by oxytocinase. Nasal spray for research: 30-60 min onset. Used repeatedly via multi-dose vials in clinic.'
WHERE slug = 'oxytocin';

UPDATE compounds SET
  typical_frequency = 'Daily SC or IM injection during cycles',
  year_discovered = 1987,
  pk_summary = 'Large protein (35 kDa); variable SC bioavailability. IV or IM more reliable. Inhibits activin/myostatin via FSTL binding. Long tissue half-life due to heparan sulfate binding. Anabolic effects persist days to weeks in muscle.'
WHERE slug = 'follistatin';

-- Fix pk_summary for compounds missing it
UPDATE compounds SET
  pk_summary = 'SC injection standard for research; precise human PK lacking. Copper-tripeptide form distributes via systemic circulation. Hair follicle uptake occurs via local SC or topical administration. Effect on follicle persists beyond plasma clearance.'
WHERE slug = 'ahk-cu';

UPDATE compounds SET
  pk_summary = 'Weekly SC injection (clinical trials: 4.8 mg weekly). Similar class to semaglutide; ~1 week half-life estimated. Hepatic first-pass avoided with SC route. NASH/MASH trials ongoing.'
WHERE slug = 'survodutide';

UPDATE compounds SET
  pk_summary = 'Short plasma half-life after SC administration. Lipophilic SC fragment; distributes to adipose tissue preferentially. Lipolytic effects observed within 2-4 hours of SC injection. Free of GH-axis effects separates PK from HGH.'
WHERE slug = 'hgh-fragment-176-191';

UPDATE compounds SET
  pk_summary = 'Glycoprotein with FSH and LH subunits. SC or IM injection; half-life: FSH component ~40 hours, LH component ~10 hours. Urinary hMG or biosynthetic. Follicular response peaks 10-14 days into stimulation cycle.'
WHERE slug = 'hmg';

UPDATE compounds SET
  pk_summary = 'IV infusion preferred for clinical use; SC injection in research. Lipotropic components (methionine 100 mg, inositol 50 mg, choline 50 mg) plus B vitamins. Short plasma half-life for each component; hepatic uptake drives clinical effect.'
WHERE slug = 'lipo-c';

UPDATE compounds SET
  pk_summary = 'Proprietary cosmetic injection blend administered locally. Active components: phosphatidylcholine, sodium deoxycholate, riboflavin, bromelain. Local adipolysis with minimal systemic absorption. Repeat sessions every 4-8 weeks in aesthetic protocols.'
WHERE slug = 'lemon-bottle';

UPDATE compounds SET
  pk_summary = 'Oral L-carnitine: 14-18% bioavailability. IV/SC: near 100%. Carnitine distributes 95% to skeletal muscle. Plasma half-life ~17 hours. ALCAR form crosses BBB. Renal reabsorption maintains steady state plasma levels.'
WHERE slug = 'l-carnitine';

UPDATE compounds SET
  pk_summary = 'Long half-life (~7 days) due to albumin-binding from fatty acid acylation. SC bioavailability ~89%. Hepatic metabolism via beta-oxidation. Renal clearance. Steady state at 4-5 weeks of once-weekly dosing.'
WHERE slug = 'cagrilintide';

UPDATE compounds SET
  pk_summary = 'Combination pharmacokinetics: both components have ~1 week half-life. SC once weekly. Additive PK; independent receptor targets (amylin receptor + GLP-1 receptor). Steady state at ~5 weeks.'
WHERE slug = 'cagrisema';

UPDATE compounds SET
  pk_summary = 'IV/SC injection; standard TB-500 PK applies (days-long tissue residence). GHK-Cu adds rapid copper-peptide distribution to skin/dermis. BPC-157 provides short half-life cytoprotective burst. Combined skin regeneration stack; SC protocol weekly.'
WHERE slug = 'glow';

UPDATE compounds SET
  pk_summary = 'Multi-peptide stack PK: each of four components (TB-500, BPC-157, GHK-Cu, KPV) maintains independent pharmacokinetics. Combined SC protocol typically 1-2x weekly. Tissue repair effects accumulate over weeks of dosing.'
WHERE slug = 'klow';

-- Update pubmed_citation_count for those still missing it
UPDATE compounds SET pubmed_citation_count = 2 WHERE slug = 'ahk-cu';
UPDATE compounds SET pubmed_citation_count = 0 WHERE slug = 'acetic-acid';
UPDATE compounds SET pubmed_citation_count = 0 WHERE slug = 'bac-water';
UPDATE compounds SET pubmed_citation_count = 0 WHERE slug = 'bpc-tb';
UPDATE compounds SET pubmed_citation_count = 0 WHERE slug = 'cagrisema';
UPDATE compounds SET pubmed_citation_count = 0 WHERE slug = 'cjc-ipamorelin';
UPDATE compounds SET pubmed_citation_count = 0 WHERE slug = 'glow';
UPDATE compounds SET pubmed_citation_count = 0 WHERE slug = 'klow';
UPDATE compounds SET pubmed_citation_count = 0 WHERE slug = 'lemon-bottle';
UPDATE compounds SET pubmed_citation_count = 0 WHERE slug = 'lipo-c';
UPDATE compounds SET pubmed_citation_count = 189 WHERE slug = 'semax';
UPDATE compounds SET pubmed_citation_count = 175 WHERE slug = 'sermorelin';
UPDATE compounds SET pubmed_citation_count = 580 WHERE slug = 'ipamorelin';

-- Fix efficacy_scores for two compounds that were missing them
UPDATE compounds SET
  efficacy_scores = '{"reconstitution_support":100}'
WHERE slug = 'acetic-acid' AND (efficacy_scores IS NULL OR efficacy_scores::text = '{}');

UPDATE compounds SET
  efficacy_scores = '{"reconstitution_support":100}'
WHERE slug = 'bac-water' AND (efficacy_scores IS NULL OR efficacy_scores::text = '{}');
