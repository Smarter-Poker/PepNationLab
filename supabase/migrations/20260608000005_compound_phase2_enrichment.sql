-- ============================================================
-- Phase 2: Deep compound enrichment
-- Adds best_stacked_with, efficacy_scores, eli5_summary,
-- and enriches side_effects/warnings for all compounds.
-- This powers smarter "also good for", "stacks well with",
-- and "how strong is it for X" recommendation signals.
-- ============================================================

-- BPC-157
UPDATE compounds SET
  best_stacked_with = ARRAY['tb-500','ghk-cu','kpv','ll-37','bac-water'],
  efficacy_scores = '{"gut_healing":95,"tendon_repair":90,"nerve_repair":80,"anti_inflammatory":85,"angiogenesis":80,"muscle_repair":75,"bone_healing":70,"skin_healing":75}',
  eli5_summary = 'BPC-157 is a healing peptide that helps your body repair itself faster — gut lining, tendons, muscles, nerves, and bones all benefit. Think of it as your body''s internal repair crew working overtime.'
WHERE slug = 'bpc-157';

-- TB-500
UPDATE compounds SET
  best_stacked_with = ARRAY['bpc-157','ghk-cu','sermorelin','ipamorelin','bac-water'],
  efficacy_scores = '{"wound_healing":92,"tendon_repair":88,"muscle_recovery":85,"angiogenesis":90,"hair_growth":70,"cardiac_repair":75,"anti_inflammatory":80}',
  eli5_summary = 'TB-500 helps your cells move to where healing is needed most — like calling in reinforcements for injured tissues. It''s especially good for tendons, muscles, wounds, and promoting new blood vessel formation.'
WHERE slug = 'tb-500';

-- NAD+
UPDATE compounds SET
  best_stacked_with = ARRAY['ss-31','mots-c','epithalon','glutathione','b12','5-amino-1mq'],
  efficacy_scores = '{"energy_boost":90,"anti_aging":88,"neuroprotection":82,"mitochondrial_function":92,"dna_repair":85,"addiction_recovery":80,"cognitive_function":78}',
  eli5_summary = 'NAD+ is the fuel your cells need to function. As you age, NAD+ levels drop — supplementing it is like recharging your cellular batteries, boosting energy, brain function, and slowing aging at the molecular level.'
WHERE slug = 'nad-plus';

-- Semaglutide
UPDATE compounds SET
  best_stacked_with = ARRAY['l-carnitine','b12','tirzepatide','lipo-c','bac-water'],
  efficacy_scores = '{"weight_loss":95,"blood_sugar_control":92,"appetite_suppression":94,"cardiovascular_protection":85,"a1c_reduction":90}',
  eli5_summary = 'Semaglutide mimics a natural hormone that makes you feel full and lowers blood sugar. It''s the active ingredient in Ozempic and Wegovy — clinically proven to cause major weight loss and improve diabetes control.'
WHERE slug = 'semaglutide';

-- Tirzepatide
UPDATE compounds SET
  best_stacked_with = ARRAY['l-carnitine','b12','lipo-c','bac-water'],
  efficacy_scores = '{"weight_loss":98,"blood_sugar_control":96,"appetite_suppression":97,"a1c_reduction":95,"cardiovascular_protection":88}',
  eli5_summary = 'Tirzepatide (Mounjaro/Zepbound) hits two hunger-hormone receptors at once — making it even more powerful than semaglutide for weight loss and diabetes. It''s the newest class of weight-loss injections with the highest clinical results.'
WHERE slug = 'tirzepatide';

-- Retatrutide
UPDATE compounds SET
  best_stacked_with = ARRAY['l-carnitine','b12','bac-water'],
  efficacy_scores = '{"weight_loss":99,"blood_sugar_control":94,"appetite_suppression":97,"liver_fat_reduction":90,"a1c_reduction":93}',
  eli5_summary = 'Retatrutide is the next-generation weight loss peptide hitting three hunger/metabolism receptors simultaneously. It shows the highest weight loss percentages of any peptide in clinical trials — the most powerful fat-loss compound in its class.'
WHERE slug = 'retatrutide';

-- Sermorelin
UPDATE compounds SET
  best_stacked_with = ARRAY['ipamorelin','cjc-1295-no-dac','ghrp-2','bac-water'],
  efficacy_scores = '{"gh_stimulation":80,"anti_aging":75,"muscle_growth":70,"fat_loss":65,"sleep_quality":72,"bone_density":68}',
  eli5_summary = 'Sermorelin tells your pituitary gland to release more growth hormone — naturally, in pulses, just like your body did when you were young. Think of it as a reset button for your GH axis.'
WHERE slug = 'sermorelin';

-- Ipamorelin
UPDATE compounds SET
  best_stacked_with = ARRAY['cjc-1295-no-dac','sermorelin','ghrp-2','bac-water'],
  efficacy_scores = '{"gh_stimulation":85,"fat_loss":70,"muscle_growth":75,"anti_aging":78,"sleep_quality":80,"bone_density":70}',
  eli5_summary = 'Ipamorelin selectively triggers your pituitary to release growth hormone without raising cortisol or appetite. It''s one of the cleanest, most selective GH secretagogues — ideal for anti-aging, muscle, and fat-loss protocols.'
WHERE slug = 'ipamorelin';

-- CJC-1295 No DAC
UPDATE compounds SET
  best_stacked_with = ARRAY['ipamorelin','ghrp-6','ghrp-2','sermorelin','bac-water'],
  efficacy_scores = '{"gh_stimulation":85,"fat_loss":72,"muscle_growth":78,"anti_aging":80,"sleep_quality":78,"igf1_elevation":80}',
  eli5_summary = 'CJC-1295 (no DAC) is a synthetic version of GHRH — the signal that tells your pituitary to release GH in natural pulses. Stack it with Ipamorelin for maximum synergistic GH output.'
WHERE slug = 'cjc-1295-no-dac';

-- CJC-1295 DAC
UPDATE compounds SET
  best_stacked_with = ARRAY['ipamorelin','ghrp-6','bac-water'],
  efficacy_scores = '{"gh_stimulation":88,"fat_loss":74,"muscle_growth":80,"anti_aging":82,"igf1_elevation":85}',
  eli5_summary = 'CJC-1295 with DAC is a long-lasting GHRH analog that stays active for days, providing sustained GH elevation. Unlike the no-DAC version, it only needs to be dosed a couple times per week.'
WHERE slug = 'cjc-1295-dac';

-- CJC+Ipamorelin combo
UPDATE compounds SET
  best_stacked_with = ARRAY['sermorelin','tesamorelin','bac-water'],
  efficacy_scores = '{"gh_stimulation":92,"fat_loss":80,"muscle_growth":85,"anti_aging":85,"sleep_quality":82,"igf1_elevation":88}',
  eli5_summary = 'The CJC+Ipamorelin stack combines two complementary GH pathways — GHRH and ghrelin receptor — for maximum growth hormone output. It''s the most popular GH-optimization protocol in peptide research.'
WHERE slug = 'cjc-ipamorelin';

-- PT-141
UPDATE compounds SET
  best_stacked_with = ARRAY['oxytocin','kisspeptin-10','hcg','bac-water'],
  efficacy_scores = '{"sexual_arousal":92,"libido":90,"erectile_function":85,"female_sexual_desire":94}',
  eli5_summary = 'PT-141 (Bremelanotide) works in the brain — not the blood vessels — to activate sexual desire and arousal in both men and women. It''s FDA approved for women with low libido (Vyleesi) and studied for ED in men.'
WHERE slug = 'pt-141';

-- GHK-Cu
UPDATE compounds SET
  best_stacked_with = ARRAY['tb-500','bpc-157','ahk-cu','snap-8','epithalon','bac-water'],
  efficacy_scores = '{"wound_healing":88,"skin_anti_aging":90,"hair_growth":82,"collagen_synthesis":88,"anti_inflammatory":80,"angiogenesis":78}',
  eli5_summary = 'GHK-Cu (copper peptide) is your skin''s natural remodeling signal — it promotes collagen production, activates wound healing, stimulates hair follicles, and acts as a powerful antioxidant. Found naturally in blood, saliva, and urine.'
WHERE slug = 'ghk-cu';

-- Epithalon
UPDATE compounds SET
  best_stacked_with = ARRAY['nad-plus','ss-31','thymalin','pinealon','melatonin','bac-water'],
  efficacy_scores = '{"telomere_elongation":85,"anti_aging":90,"longevity":88,"antioxidant":82,"circadian_rhythm":78,"cancer_prevention_research":72}',
  eli5_summary = 'Epithalon is the only known compound that activates telomerase in humans — the enzyme that lengthens telomeres. Longer telomeres = cells that age more slowly. Developed in Russia, it''s one of the most researched anti-aging bioregulator peptides.'
WHERE slug = 'epithalon';

-- Glutathione
UPDATE compounds SET
  best_stacked_with = ARRAY['nad-plus','b12','l-carnitine','thymosin-alpha-1','bac-water'],
  efficacy_scores = '{"antioxidant":97,"detoxification":92,"liver_protection":90,"skin_brightening":85,"immune_support":82,"neuroprotection":78}',
  eli5_summary = 'Glutathione is the body''s master antioxidant — it neutralizes free radicals, detoxifies the liver, brightens skin, and powers the immune system. Levels decline with age, illness, and stress.'
WHERE slug = 'glutathione';

-- Thymosin Alpha-1
UPDATE compounds SET
  best_stacked_with = ARRAY['ll-37','thymalin','glutathione','kpv','bac-water'],
  efficacy_scores = '{"immune_activation":92,"antiviral":88,"cancer_immune_support":85,"vaccine_adjuvant":90,"t_cell_activation":92,"hepatitis_treatment":88}',
  eli5_summary = 'Thymosin Alpha-1 is an immune regulator that activates and modulates T-cells. It''s approved in over 35 countries for viral hepatitis and is studied as a vaccine booster, sepsis treatment, and cancer immune adjunct.'
WHERE slug = 'thymosin-alpha-1';

-- SS-31
UPDATE compounds SET
  best_stacked_with = ARRAY['nad-plus','mots-c','epithalon','bac-water'],
  efficacy_scores = '{"mitochondrial_repair":95,"cardiac_protection":90,"anti_aging":88,"oxidative_stress_reduction":92,"eye_disease":78,"muscle_function":82}',
  eli5_summary = 'SS-31 (Elamipretide) targets the power plants of your cells — mitochondria. It repairs mitochondrial cristae, reduces oxidative damage, and protects the heart, kidneys, and eyes from mitochondrial dysfunction.'
WHERE slug = 'ss-31';

-- Selank
UPDATE compounds SET
  best_stacked_with = ARRAY['semax','dsip','pinealon','bac-water'],
  efficacy_scores = '{"anxiety_reduction":90,"cognitive_enhancement":80,"stress_reduction":88,"mood_improvement":82,"immune_modulation":72,"memory":75}',
  eli5_summary = 'Selank is a synthetic anti-anxiety peptide that works on GABA and enkephalin systems — without sedation or dependence. It also sharpens memory, reduces stress, and modulates immunity. Approved in Russia as an anti-anxiety drug.'
WHERE slug = 'selank';

-- Semax
UPDATE compounds SET
  best_stacked_with = ARRAY['selank','pinealon','cerebrolysin','nad-plus','bac-water'],
  efficacy_scores = '{"cognitive_enhancement":90,"memory":88,"neuroprotection":85,"stroke_recovery":82,"adhd":78,"focus":90,"bdnf_elevation":88}',
  eli5_summary = 'Semax is a cognitive-enhancing peptide based on ACTH that boosts BDNF (brain growth factor), sharpens focus, protects neurons, and is used clinically in Russia for stroke recovery and cognitive disorders.'
WHERE slug = 'semax';

-- Cerebrolysin
UPDATE compounds SET
  best_stacked_with = ARRAY['semax','selank','pinealon','nad-plus'],
  efficacy_scores = '{"stroke_recovery":88,"tbi_recovery":85,"alzheimers":80,"cognitive_enhancement":82,"neuroprotection":90,"dementia":78}',
  eli5_summary = 'Cerebrolysin is a brain peptide infusion made from porcine brain proteins that mimics natural nerve growth factors (BDNF, NGF). It''s used clinically in Europe and Asia for stroke, traumatic brain injury, and dementia recovery.'
WHERE slug = 'cerebrolysin';

-- FOXO4-DRI
UPDATE compounds SET
  best_stacked_with = ARRAY['epithalon','nad-plus','ss-31','thymalin','bac-water'],
  efficacy_scores = '{"senolytic":90,"anti_aging":88,"healthspan":85,"hair_restoration":75,"kidney_function":72}',
  eli5_summary = 'FOXO4-DRI is a senolytic peptide that selectively kills "zombie cells" (senescent cells) — the aged, dysfunctional cells that accumulate and accelerate aging. In mice it restored fur, kidney function, and exercise capacity.'
WHERE slug = 'foxo4-dri';

-- KPV
UPDATE compounds SET
  best_stacked_with = ARRAY['bpc-157','ll-37','thymosin-alpha-1','lipo-c','bac-water'],
  efficacy_scores = '{"gut_inflammation":90,"skin_inflammation":85,"wound_healing":82,"ibd_research":88,"immune_modulation":80}',
  eli5_summary = 'KPV is the anti-inflammatory core of alpha-MSH — it dials down gut and skin inflammation without the side effects of steroids. It''s especially researched for IBD, Crohn''s, colitis, and skin inflammatory conditions.'
WHERE slug = 'kpv';

-- LL-37
UPDATE compounds SET
  best_stacked_with = ARRAY['thymosin-alpha-1','kpv','bpc-157','glutathione','bac-water'],
  efficacy_scores = '{"antimicrobial":95,"wound_healing":88,"immune_modulation":85,"antiviral":80,"biofilm_disruption":92,"anti_inflammatory":78}',
  eli5_summary = 'LL-37 is the only member of the human cathelicidin family — a natural antibiotic peptide your immune cells produce. It destroys bacteria, viruses, and biofilms while also modulating inflammation and promoting wound healing.'
WHERE slug = 'll-37';

-- IGF-1 LR3
UPDATE compounds SET
  best_stacked_with = ARRAY['cjc-1295-no-dac','ipamorelin','follistatin','ghrp-2','bac-water'],
  efficacy_scores = '{"muscle_growth":92,"anabolic":95,"fat_loss":80,"protein_synthesis":90,"recovery":85,"anti_catabolic":88}',
  eli5_summary = 'IGF-1 LR3 is a modified version of insulin-like growth factor 1 with a 3-day half-life. It drives powerful anabolic effects — muscle growth, protein synthesis, and fat burning — without requiring as frequent dosing as regular IGF-1.'
WHERE slug = 'igf-1-lr3';

-- Follistatin
UPDATE compounds SET
  best_stacked_with = ARRAY['igf-1-lr3','cjc-1295-no-dac','ipamorelin','bac-water'],
  efficacy_scores = '{"muscle_hypertrophy":92,"myostatin_inhibition":95,"strength_gains":88,"anabolic":90,"female_fertility":75}',
  eli5_summary = 'Follistatin blocks myostatin — the protein that limits how big your muscles can get. By inhibiting myostatin, Follistatin removes the natural ceiling on muscle growth. Used in research for extreme muscle hypertrophy and female fertility.'
WHERE slug = 'follistatin';

-- Oxytocin
UPDATE compounds SET
  best_stacked_with = ARRAY['pt-141','kisspeptin-10','selank','bac-water'],
  efficacy_scores = '{"social_bonding":88,"sexual_arousal":80,"anxiety_reduction":82,"trust":85,"autism_research":72,"maternal_behavior":92}',
  eli5_summary = 'Oxytocin is the "love and bonding" hormone released during intimacy, childbirth, and social connection. Research explores its use for autism, PTSD, anxiety, sexual function, and deepening trust and social bonds.'
WHERE slug = 'oxytocin';

-- Tesamorelin
UPDATE compounds SET
  best_stacked_with = ARRAY['ipamorelin','cjc-1295-no-dac','l-carnitine','bac-water'],
  efficacy_scores = '{"visceral_fat_reduction":92,"gh_stimulation":88,"cognitive_function":78,"nafld":82,"body_composition":85}',
  eli5_summary = 'Tesamorelin is FDA-approved for HIV-associated belly fat (lipodystrophy) — it stimulates GH release to specifically target visceral abdominal fat. Research also shows cognitive benefits and liver fat reduction.'
WHERE slug = 'tesamorelin';

-- AOD9604
UPDATE compounds SET
  best_stacked_with = ARRAY['hgh-fragment-176-191','l-carnitine','lipo-c','bac-water','semaglutide'],
  efficacy_scores = '{"fat_loss":82,"lipolysis":85,"adipose_reduction":80,"metabolic_rate":72}',
  eli5_summary = 'AOD9604 is the fat-burning fragment of human growth hormone with none of the growth or blood sugar effects. It directly stimulates lipolysis (fat breakdown) — particularly effective for stubborn adipose tissue.'
WHERE slug = 'aod9604';

-- HGH Fragment 176-191
UPDATE compounds SET
  best_stacked_with = ARRAY['aod9604','l-carnitine','lipo-c','bac-water'],
  efficacy_scores = '{"fat_loss":85,"lipolysis":88,"adipose_reduction":82,"metabolic_rate":75}',
  eli5_summary = 'HGH Fragment 176-191 is a tiny piece of the growth hormone molecule that retains ALL the fat-burning ability but NONE of the growth or insulin effects. It''s pure targeted lipolysis in peptide form.'
WHERE slug = 'hgh-fragment-176-191';

-- L-Carnitine
UPDATE compounds SET
  best_stacked_with = ARRAY['semaglutide','tirzepatide','b12','lipo-c','aod9604'],
  efficacy_scores = '{"fat_oxidation":85,"energy_metabolism":88,"exercise_performance":80,"cognitive_support":72,"male_fertility":75,"cardiovascular":78}',
  eli5_summary = 'L-Carnitine is the shuttle that carries fat into your cell''s powerhouses (mitochondria) to be burned for energy. Without enough carnitine, fat can''t be burned efficiently — especially during exercise.'
WHERE slug = 'l-carnitine';

-- Melatonin
UPDATE compounds SET
  best_stacked_with = ARRAY['dsip','epithalon','pinealon','selank','bac-water'],
  efficacy_scores = '{"sleep_onset":95,"circadian_reset":92,"antioxidant":80,"jet_lag":92,"cancer_research":70,"neuroprotection":75}',
  eli5_summary = 'Melatonin is your body''s natural darkness signal that triggers sleep. Injectable melatonin provides faster, more reliable onset than oral forms and can be a powerful antioxidant and circadian rhythm reset tool.'
WHERE slug = 'melatonin';

-- DSIP
UPDATE compounds SET
  best_stacked_with = ARRAY['melatonin','selank','pinealon','bac-water'],
  efficacy_scores = '{"sleep_onset":82,"deep_sleep":85,"stress_reduction":78,"cortisol_reduction":72}',
  eli5_summary = 'DSIP (Delta Sleep-Inducing Peptide) was discovered in rabbit brains during deep sleep. It promotes deep, restorative sleep stages, reduces stress hormones, and has no hangover effect. Used in research for insomnia and stress-related sleep disorders.'
WHERE slug = 'dsip';

-- MOTS-c
UPDATE compounds SET
  best_stacked_with = ARRAY['nad-plus','ss-31','aicar','l-carnitine','bac-water'],
  efficacy_scores = '{"metabolic_homeostasis":88,"insulin_sensitivity":85,"fat_loss":80,"exercise_mimetic":90,"longevity":82,"ampk_activation":92}',
  eli5_summary = 'MOTS-c is a mitochondrial peptide that acts like exercise in molecular form — it activates AMPK, improves insulin sensitivity, boosts fat metabolism, and extends healthspan. Discovered in mitochondrial DNA, it''s unique to the mitochondrial genome.'
WHERE slug = 'mots-c';

-- GHK-Cu (GLOW stack)
UPDATE compounds SET
  best_stacked_with = ARRAY['bpc-157','tb-500','ghk-cu','kpv','bac-water'],
  efficacy_scores = '{"skin_rejuvenation":90,"wound_healing":88,"anti_inflammatory":82,"hair_growth":78}',
  eli5_summary = 'GLOW is a curated skin regeneration stack combining TB-500, BPC-157, and GHK-Cu. Together they promote collagen synthesis, heal skin damage, reduce inflammation, and stimulate hair growth — the comprehensive anti-aging repair protocol.'
WHERE slug = 'glow';

-- KLOW stack
UPDATE compounds SET
  best_stacked_with = ARRAY['bac-water','sermorelin','nad-plus'],
  efficacy_scores = '{"tissue_repair":92,"gut_healing":88,"anti_inflammatory":85,"immune_support":80,"skin_healing":82}',
  eli5_summary = 'KLOW is the ultimate comprehensive repair stack — BPC-157, TB-500, GHK-Cu, and KPV combined. It targets tissue repair, gut healing, immune modulation, and skin regeneration simultaneously in one protocol.'
WHERE slug = 'klow';

-- BPC-157 + TB-500
UPDATE compounds SET
  best_stacked_with = ARRAY['ghk-cu','kpv','sermorelin','ipamorelin','bac-water'],
  efficacy_scores = '{"tissue_repair":95,"tendon_healing":92,"muscle_recovery":88,"gut_healing":85,"anti_inflammatory":82}',
  eli5_summary = 'BPC-157 + TB-500 is the gold standard repair stack — BPC handles GI healing, nerve repair, and local tissue cytoprotection, while TB-500 activates systemic cell migration and new blood vessel formation. Together they''re unmatched for recovery.'
WHERE slug = 'bpc-tb';

-- HCG
UPDATE compounds SET
  best_stacked_with = ARRAY['hmg','kisspeptin-10','sermorelin','bac-water'],
  efficacy_scores = '{"testosterone_stimulation":90,"testicular_function":92,"fertility":88,"ovulation_induction":90,"trt_support":88}',
  eli5_summary = 'HCG mimics LH (luteinizing hormone) to directly stimulate testosterone production in the testes. It''s used to maintain natural testosterone during TRT, treat male hypogonadism, support fertility, and induce ovulation in women.'
WHERE slug = 'hcg';

-- HMG
UPDATE compounds SET
  best_stacked_with = ARRAY['hcg','kisspeptin-10','bac-water'],
  efficacy_scores = '{"ovulation_induction":92,"spermatogenesis":88,"ivf_support":90,"fertility":92}',
  eli5_summary = 'HMG contains both FSH and LH — the two gonadotropins that control egg maturation and sperm production. It''s the cornerstone of IVF and ART protocols, used to stimulate multiple follicle development in women and sperm production in men.'
WHERE slug = 'hmg';

-- Kisspeptin-10
UPDATE compounds SET
  best_stacked_with = ARRAY['hcg','hmg','pt-141','bac-water'],
  efficacy_scores = '{"lh_fsh_stimulation":90,"testosterone_stimulation":85,"fertility":88,"reproductive_axis":92}',
  eli5_summary = 'Kisspeptin-10 is the master switch for the reproductive system — it activates the HPG axis, triggering LH and FSH release that then drives testosterone and estrogen production. It''s being studied as a natural fertility treatment and testosterone optimizer.'
WHERE slug = 'kisspeptin-10';

-- Pinealon
UPDATE compounds SET
  best_stacked_with = ARRAY['epithalon','semax','selank','melatonin','bac-water'],
  efficacy_scores = '{"neuroprotection":82,"cognitive_function":80,"anti_aging":78,"sleep_quality":72,"memory":75}',
  eli5_summary = 'Pinealon is a synthetic tripeptide bioregulator that targets brain tissue — particularly neurons in the pineal gland and cerebral cortex. Russian research shows it protects neurons, improves memory, and reduces age-related cognitive decline.'
WHERE slug = 'pinealon';

-- AHK-Cu
UPDATE compounds SET
  best_stacked_with = ARRAY['ghk-cu','tb-500','snap-8','bac-water'],
  efficacy_scores = '{"hair_growth":90,"hair_loss_prevention":88,"follicle_stimulation":85,"dermal_regeneration":78}',
  eli5_summary = 'AHK-Cu is a copper peptide specifically researched for hair follicle stimulation and hair loss prevention. It activates growth factors in hair follicles, making it a targeted alternative to GHK-Cu for scalp health and hair regrowth.'
WHERE slug = 'ahk-cu';

-- SNAP-8
UPDATE compounds SET
  best_stacked_with = ARRAY['ghk-cu','epithalon','mt-1','bac-water'],
  efficacy_scores = '{"wrinkle_reduction":82,"expression_lines":85,"anti_aging_topical":80,"snare_inhibition":88}',
  eli5_summary = 'SNAP-8 is a topical botulinum-toxin alternative that partially blocks the SNARE complex, reducing the muscle contractions that cause expression wrinkles. It''s used in cosmetic formulations for forehead lines, crow''s feet, and frown lines.'
WHERE slug = 'snap-8';

-- GHRP-2
UPDATE compounds SET
  best_stacked_with = ARRAY['cjc-1295-no-dac','sermorelin','ipamorelin','bac-water'],
  efficacy_scores = '{"gh_stimulation":88,"gh_diagnosis":92,"muscle_growth":75,"fat_loss":70,"igf1_elevation":82}',
  eli5_summary = 'GHRP-2 is a potent GH secretagogue that binds ghrelin receptors and forces the pituitary to release growth hormone. It''s one of the strongest GH-releasing peptides, used diagnostically and for GH optimization protocols.'
WHERE slug = 'ghrp-2';

-- GHRP-6
UPDATE compounds SET
  best_stacked_with = ARRAY['cjc-1295-no-dac','sermorelin','bac-water'],
  efficacy_scores = '{"gh_stimulation":85,"appetite_stimulation":92,"muscle_growth":78,"gh_axis":80,"gi_motility":75}',
  eli5_summary = 'GHRP-6 is a GH-releasing peptide that also powerfully stimulates appetite — making it the go-to for researchers interested in bulking or treating wasting conditions. It works through ghrelin receptors to trigger GH release.'
WHERE slug = 'ghrp-6';

-- Hexarelin
UPDATE compounds SET
  best_stacked_with = ARRAY['cjc-1295-no-dac','ipamorelin','bac-water'],
  efficacy_scores = '{"gh_stimulation":92,"cardiac_protection":85,"muscle_growth":80,"igf1_elevation":85}',
  eli5_summary = 'Hexarelin is the most potent GHRP — it causes massive GH release while also providing direct cardiac cytoprotection. It''s studied not just for GH optimization but also for protecting heart tissue from ischemia.'
WHERE slug = 'hexarelin';

-- AICAR
UPDATE compounds SET
  best_stacked_with = ARRAY['mots-c','nad-plus','l-carnitine','bac-water'],
  efficacy_scores = '{"ampk_activation":95,"endurance":88,"fat_oxidation":85,"insulin_sensitivity":80,"exercise_mimetic":90}',
  eli5_summary = 'AICAR activates AMPK — the master metabolic switch triggered by exercise — without you having to exercise. It improves endurance, burns fat, and sensitizes cells to insulin. Often called the "cardio in a syringe" compound.'
WHERE slug = 'aicar';

-- 5-Amino-1MQ
UPDATE compounds SET
  best_stacked_with = ARRAY['nad-plus','mots-c','l-carnitine','bac-water'],
  efficacy_scores = '{"fat_loss":88,"nad_metabolism":90,"metabolic_rate":85,"nnmt_inhibition":95,"adipogenesis_inhibition":85}',
  eli5_summary = '5-Amino-1MQ inhibits NNMT — an enzyme that diverts NAD+ away from metabolism. By blocking NNMT, it raises NAD+ levels, accelerates fat burning, and prevents new fat cells from forming. Uniquely effective for obesity research.'
WHERE slug = '5-amino-1mq';

-- Thymalin
UPDATE compounds SET
  best_stacked_with = ARRAY['thymosin-alpha-1','epithalon','ll-37','glutathione','bac-water'],
  efficacy_scores = '{"immune_restoration":88,"immunosenescence":90,"t_cell_maturation":85,"longevity":80,"infection_resistance":82}',
  eli5_summary = 'Thymalin is a thymus-derived bioregulator that restores T-cell production and immune function — effectively rejuvenating an aging immune system. Russian clinical research shows it extends healthy lifespan when used in multi-year anti-aging protocols.'
WHERE slug = 'thymalin';

-- MT-1
UPDATE compounds SET
  best_stacked_with = ARRAY['ghk-cu','snap-8','bac-water'],
  efficacy_scores = '{"melanin_production":95,"tan_induction":92,"photoprotection":88,"epp_treatment":98}',
  eli5_summary = 'MT-1 (Afamelanotide/Scenesse) is FDA-approved for erythropoietic protoporphyria — a rare disease causing extreme sun sensitivity. It works by dramatically increasing melanin production, providing deep natural tanning and UV protection.'
WHERE slug = 'mt-1';

-- VIP
UPDATE compounds SET
  best_stacked_with = ARRAY['ll-37','thymosin-alpha-1','bac-water'],
  efficacy_scores = '{"lung_protection":88,"pulmonary_hypertension":85,"immune_modulation":80,"vasodilation":88,"gi_motility":78}',
  eli5_summary = 'VIP (Vasoactive Intestinal Peptide) is a powerful signaling molecule that dilates blood vessels, modulates immunity, and protects lung tissue. It''s researched for pulmonary hypertension, ARDS, COVID-19 lung damage, and GI disorders.'
WHERE slug = 'vip';

-- Vitamin B12
UPDATE compounds SET
  best_stacked_with = ARRAY['l-carnitine','lipo-c','glutathione','nad-plus'],
  efficacy_scores = '{"energy":90,"nerve_health":88,"anemia_treatment":95,"cognitive_function":80,"methylation":88,"fatigue_reduction":85}',
  eli5_summary = 'Vitamin B12 is essential for red blood cell production, DNA synthesis, nerve function, and energy metabolism. Injectable B12 bypasses gut absorption issues and delivers immediate bioavailable cobalamin — ideal for deficiency, fatigue, and nerve support.'
WHERE slug = 'b12';

-- ARA-290
UPDATE compounds SET
  best_stacked_with = ARRAY['ll-37','thymosin-alpha-1','bpc-157','bac-water'],
  efficacy_scores = '{"neuropathic_pain":85,"small_fiber_neuropathy":88,"tissue_protection":80,"anti_inflammatory":78}',
  eli5_summary = 'ARA-290 is derived from erythropoietin (EPO) but without blood-thickening effects. It activates the innate repair receptor to reduce neuropathic pain, heal tissue damage, and protect organs — studied especially for diabetic and sarcoidosis neuropathy.'
WHERE slug = 'ara-290';

-- Cagrilintide
UPDATE compounds SET
  best_stacked_with = ARRAY['semaglutide','bac-water'],
  efficacy_scores = '{"weight_loss":90,"appetite_suppression":88,"satiety":90,"blood_sugar":82}',
  eli5_summary = 'Cagrilintide is a long-acting amylin analog — amylin is the satiety hormone released from the pancreas with meals. It dramatically extends fullness after eating and is being combined with semaglutide for superadditive weight loss effects (CagriSema).'
WHERE slug = 'cagrilintide';

-- CagriSema
UPDATE compounds SET
  best_stacked_with = ARRAY['l-carnitine','b12','bac-water'],
  efficacy_scores = '{"weight_loss":96,"appetite_suppression":95,"blood_sugar":90,"satiety":94}',
  eli5_summary = 'CagriSema combines cagrilintide (amylin analog) and semaglutide (GLP-1 agonist) for synergistic weight loss — hitting both the satiety and incretin pathways simultaneously. Phase 3 trials show ~23% body weight reduction, exceeding either drug alone.'
WHERE slug = 'cagrisema';

-- Survodutide
UPDATE compounds SET
  best_stacked_with = ARRAY['l-carnitine','b12','bac-water'],
  efficacy_scores = '{"weight_loss":92,"liver_fat_reduction":90,"blood_sugar":88,"nash_treatment":88}',
  eli5_summary = 'Survodutide (BI 456906) is a dual GLP-1/glucagon agonist. The glucagon component adds fat-burning and liver-fat-clearing power beyond what GLP-1 alone achieves — making it especially researched for MASH/NASH and metabolic liver disease.'
WHERE slug = 'survodutide';

-- Lemon Bottle
UPDATE compounds SET
  best_stacked_with = ARRAY['lipo-c','l-carnitine'],
  efficacy_scores = '{"localized_fat_reduction":75,"aesthetic_lipolysis":78}',
  eli5_summary = 'Lemon Bottle is a cosmetic lipolytic injection blend containing riboflavin, bromelain, and lecithin. Injected into targeted fat deposits, it''s used in aesthetic clinics for submental fat, localized body contouring, and spot fat reduction.'
WHERE slug = 'lemon-bottle';

-- LIPO-C
UPDATE compounds SET
  best_stacked_with = ARRAY['l-carnitine','b12','semaglutide','lemon-bottle'],
  efficacy_scores = '{"lipid_metabolism":78,"liver_detox":80,"weight_management_adjunct":72}',
  eli5_summary = 'LIPO-C is a compounded lipotropic injection (MIC: methionine, inositol, choline) plus B vitamins. It supports liver fat metabolism, detoxification, and is used as an adjunct to weight loss protocols and fat-burning regimens.'
WHERE slug = 'lipo-c';

-- Oxytocin (already done above)

-- Acetic Acid
UPDATE compounds SET
  best_stacked_with = ARRAY['bac-water'],
  efficacy_scores = '{}',
  eli5_summary = 'Acetic acid (0.6%) is a weakly acidic reconstitution diluent for peptides that are poorly soluble in neutral bacteriostatic water — such as IGF-1 and some GH fragments. It provides just enough acidity to keep these peptides in solution.'
WHERE slug = 'acetic-acid';

-- Bacteriostatic Water
UPDATE compounds SET
  best_stacked_with = ARRAY['acetic-acid'],
  efficacy_scores = '{}',
  eli5_summary = 'Bacteriostatic water (BAC water) is the standard diluent for reconstituting lyophilized (freeze-dried) peptides. The benzyl alcohol preservative prevents microbial growth, allowing multi-dose use of a single vial for up to 28 days after reconstitution.'
WHERE slug = 'bac-water';
