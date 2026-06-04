-- ============================================================================
-- 20260605090000_maximize_compound_searchability.sql
-- ----------------------------------------------------------------------------
-- Maximizes aliases[], studied_for[], research_areas[], compound_class, and
-- molecular_target for all 65 active compounds so that any researcher search —
-- by brand name, abbreviation, mechanism, condition, goal, lay term, or
-- chemical name — resolves to the correct compound.
-- ============================================================================

BEGIN;

-- ==========================================================================
-- 1. ACETIC ACID (Diluent)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Dilute acetic acid diluent','Acetic acid 0.6%','0.6% acetic acid','Glacial acetic acid',
    'Ethanoic acid','Vinegar acid','CH3COOH','HAc','AcOH','Acetic acid solution',
    'Peptide diluent','Peptide solvent','Reconstitution diluent','Acidic reconstitution vehicle'
  ],
  studied_for = ARRAY[
    'Reconstituting poorly soluble peptides','Peptide dissolution vehicle',
    'Solubilizing hydrophobic peptides','IGF-1 LR3 reconstitution','Follistatin reconstitution',
    'BPC-157 diluent','Acidic peptide carrier','Lyophilized peptide preparation',
    'Research-grade peptide solvent','Low pH peptide stability'
  ],
  research_areas = ARRAY['supply'],
  compound_class = 'Acidic aqueous diluent / reconstitution vehicle',
  molecular_target = 'No pharmacological target; stabilizes peptides via low-pH environment'
WHERE slug = 'acetic-acid';

-- ==========================================================================
-- 2. AOD9604
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'AOD 9604','AOD-9604','Tyr-hGH 177-191','hGH fragment 177-191','HGH fragment 177-191',
    'Anti-obesity drug 9604','Advanced obesity drug','AOD9604 peptide','Metabol',
    'C-terminal growth hormone fragment','GH fat-loss fragment','lipolytic GH peptide'
  ],
  studied_for = ARRAY[
    'Obesity / fat-metabolism research','Lipolysis / fat burning','Adipose tissue reduction',
    'Body fat reduction without IGF-1 elevation','Visceral fat loss','Subcutaneous fat reduction',
    'Weight management','Metabolic syndrome research','Fat-loss peptide research',
    'Non-GH lipid metabolism','Carbohydrate metabolism','Anti-obesity research',
    'Body composition improvement','Abdominal fat reduction','Fat oxidation enhancement'
  ],
  research_areas = ARRAY['metabolic','weight_management','performance'],
  compound_class = 'Modified C-terminal growth-hormone fragment (hGH 177-191)',
  molecular_target = 'Lipolysis via beta-3 adrenergic and lipase pathways; no GH receptor binding; no IGF-1 elevation'
WHERE slug = 'aod9604';

-- ==========================================================================
-- 3. BACTERIOSTATIC WATER (Diluent)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Bac water','BAC water','Bacteriostatic water','Bac. water','BW','0.9% benzyl alcohol water',
    'Sterile water with benzyl alcohol','Multi-dose vial diluent','Preserved sterile water',
    'Reconstitution water','Peptide reconstitution water','Sterile diluent',
    'Injectable water preservative'
  ],
  studied_for = ARRAY[
    'Reconstituting lyophilized peptides','Multi-dose peptide reconstitution',
    'Preventing microbial growth in reconstituted vials','Peptide solubilization',
    'HGH reconstitution','Semaglutide reconstitution','Peptide injection preparation',
    'Research peptide diluent','Bacteriostatic preservation of peptide solutions',
    'Injectable preparation vehicle'
  ],
  research_areas = ARRAY['supply'],
  compound_class = 'Sterile preserved aqueous diluent (0.9% benzyl alcohol)',
  molecular_target = 'No pharmacological target; benzyl alcohol inhibits microbial growth in reconstituted peptide vials'
WHERE slug = 'bac-water';

-- ==========================================================================
-- 4. BPC-157
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Body Protection Compound 157','BPC157','Pentadecapeptide BPC 157',
    'Booly Protection Compound 157','Stable gastric pentadecapeptide',
    'Body protection compound','BPC 157 acetate','Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val',
    'Bepecin','PLD-116','PL 14736','PL-10','Arg-Gly-Asp peptide analog',
    'Cytoprotective peptide','Gastric pentadecapeptide'
  ],
  studied_for = ARRAY[
    'GI mucosal healing','Tendon / ligament repair','Nerve repair','Anti-inflammatory',
    'Gut health and integrity','Leaky gut research','IBD / Crohn''s disease models',
    'Ulcerative colitis models','Gastric ulcer healing','Intestinal anastomosis healing',
    'Wound healing acceleration','Muscle tear recovery','Sports injury recovery',
    'Joint inflammation reduction','Bone healing','Cartilage repair',
    'Neurological recovery','Spinal cord injury models','Peripheral nerve regeneration',
    'Angiogenesis promotion','Blood pressure regulation','Nitric oxide pathway',
    'Growth hormone receptor upregulation','Cytoprotection','Systemic healing',
    'NSAID-induced gastric damage reversal','Alcohol-induced gut damage reversal',
    'Post-surgical healing','Scar reduction','Anti-ulcer research'
  ],
  research_areas = ARRAY['healing','tissue_repair','gut_health','pain_inflammation','bone_joint','immune'],
  compound_class = 'Synthetic pentadecapeptide derived from human gastric juice protein BPC',
  molecular_target = 'NO-synthase, VEGF, FAK/paxillin, EGF receptor, growth hormone receptor; promotes angiogenesis, collagen synthesis, and cytoprotection'
WHERE slug = 'bpc-157';

-- ==========================================================================
-- 5. BPC-157 + TB-500 STACK
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'BPC TB stack','BPC+TB','BPC TB combo','TB BPC stack','BPC-157 Thymosin Beta-4 stack',
    'BPC TB-500','TB500 BPC157 blend','Healing stack','Tissue repair stack',
    'Recovery peptide stack','BPC 157 TB 500 combination','Soft tissue blend'
  ],
  studied_for = ARRAY[
    'Soft-tissue repair research','Combined healing and regeneration','Tendon repair acceleration',
    'Ligament healing','Muscle injury recovery','Sports injury research','Post-surgical healing',
    'Wound closure acceleration','Joint repair','Anti-inflammatory synergy',
    'Nerve regeneration with tissue repair','Comprehensive tissue healing protocol',
    'GI healing with systemic repair','Athletic recovery research','Injury rehabilitation research'
  ],
  research_areas = ARRAY['healing','tissue_repair','pain_inflammation','bone_joint'],
  compound_class = 'Peptide stack (BPC-157 + Thymosin Beta-4)',
  molecular_target = 'Dual-pathway: BPC-157 via NO/VEGF/EGF; TB-500 via actin-G sequestration and VEGF upregulation'
WHERE slug = 'bpc-tb';

-- ==========================================================================
-- 6. CAGRILINTIDE + SEMAGLUTIDE (CagriSema)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'CagriSema','CagriSema combination','Cagrilintide semaglutide','AM833 NN9535',
    'Amylin GLP-1 dual agonist','Dual obesity drug','CagriSema stack',
    'Amylin analog + GLP-1 agonist','Anti-obesity dual therapy','CagriSema combo',
    'Cagrilintide with semaglutide'
  ],
  studied_for = ARRAY[
    'Obesity / overweight','Type 2 diabetes','Dual-mechanism weight loss',
    'GLP-1 plus amylin dual therapy','Cardiometabolic disease','HbA1c reduction',
    'Appetite suppression dual pathway','Body weight reduction','Metabolic syndrome',
    'Insulin resistance','Blood sugar control','Caloric intake reduction research',
    'Combination incretin amylin therapy','Cardiovascular risk reduction'
  ],
  research_areas = ARRAY['metabolic','weight_management','hormonal'],
  compound_class = 'Fixed-ratio combination: long-acting amylin analog (cagrilintide) + GLP-1 receptor agonist (semaglutide)',
  molecular_target = 'Amylin/calcitonin receptors (cagrilintide) + GLP-1 receptor (semaglutide); dual satiety and glucose regulation'
WHERE slug = 'cagrisema';

-- ==========================================================================
-- 7. CJC-1295 WITH DAC
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'CJC-1295 DAC','CJC 1295 with DAC','CJC1295 DAC','GHRH analog with DAC',
    'CJC-1295 Drug Affinity Complex','DAC-GRF','Modified GHRH long-acting',
    'CJC 1295 extended release','CJC-1295 albumin-binding GHRH',
    'Long-acting GHRH analog','Growth hormone releasing hormone analog DAC',
    'CJC1295 with drug affinity complex'
  ],
  studied_for = ARRAY[
    'GH pulsatile release research','GH-axis anti-aging','Growth hormone deficiency',
    'Extended GH secretion','Anti-aging / longevity via GH axis','Muscle growth via GH axis',
    'Body composition improvement','Fat reduction via GH','Sleep quality enhancement',
    'IGF-1 elevation research','Recovery and repair via GH axis',
    'Bone density via GH stimulation','Collagen synthesis via GH axis',
    'Metabolic rate increase','Adult GH deficiency models','GH secretagogue research'
  ],
  research_areas = ARRAY['performance','longevity','metabolic','bone_joint'],
  compound_class = 'Long-acting synthetic GHRH analog with Drug Affinity Complex (DAC) albumin-binding moiety',
  molecular_target = 'GHRH receptor (GHRHR) on pituitary somatotrophs; sustained GH and IGF-1 elevation'
WHERE slug = 'cjc-1295-dac';

-- ==========================================================================
-- 8. CJC-1295 WITHOUT DAC (Mod GRF 1-29)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'CJC-1295 no DAC','Mod GRF 1-29','Modified GRF 1-29','Modified GRF','ModGRF',
    'CJC1295 without DAC','Sermorelin analog','GHRH 1-29 analog',
    'Growth hormone releasing hormone 1-29','CJC 1295 no-DAC','Short-acting GHRH analog',
    'Modified growth releasing factor','GRF 1-29 tetrasubstituted'
  ],
  studied_for = ARRAY[
    'Pulsatile GH simulation','GH secretagogue research','Sleep quality improvement',
    'Stacked with ipamorelin for synergistic GH release','Anti-aging via GH axis',
    'Body composition / lean mass','GH deficiency models','Fat loss via GH axis',
    'Recovery and tissue repair via GH','Bone density support',
    'IGF-1 elevation','Collagen synthesis promotion','Skin quality research',
    'Athletic performance research','GH pulse amplitude enhancement'
  ],
  research_areas = ARRAY['performance','longevity','metabolic','bone_joint','sleep'],
  compound_class = 'Short-acting synthetic GHRH analog (Mod GRF 1-29); no albumin-binding DAC moiety',
  molecular_target = 'GHRH receptor (GHRHR) on anterior pituitary somatotrophs; augments natural pulsatile GH release'
WHERE slug = 'cjc-1295-no-dac';

-- ==========================================================================
-- 9. CJC-1295 (No-DAC) + IPAMORELIN STACK
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'CJC IPA stack','CJC+Ipamorelin','CJC Ipamorelin blend','Mod GRF Ipamorelin stack',
    'CJC ipamorelin combo','CJC-1295 ipamorelin','GH stack','GHRH GHRP stack',
    'CJC1295 IPA','GH secretagogue dual stack','CJC ipa','CJC ipa protocol'
  ],
  studied_for = ARRAY[
    'Dual-pathway GH stimulation research','Synergistic GH release','GHRH plus GHRP combination',
    'Maximum GH pulse amplification','Anti-aging via GH axis','Body composition improvement',
    'Lean muscle gain research','Fat loss via GH','Sleep quality and GH rhythm',
    'Recovery acceleration','IGF-1 elevation','Bone density via dual GH stimulation',
    'Athletic performance research','GH axis optimization','Longevity via GH support'
  ],
  research_areas = ARRAY['performance','longevity','metabolic','bone_joint','sleep'],
  compound_class = 'Peptide stack: GHRH analog (CJC-1295 no-DAC) + selective GHRP (Ipamorelin)',
  molecular_target = 'Dual: GHRH receptor (CJC component) + ghrelin/GHS-R1a receptor (Ipamorelin component); synergistic pituitary GH release'
WHERE slug = 'cjc-ipamorelin';

-- ==========================================================================
-- 10. DSIP (Delta Sleep-Inducing Peptide)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Delta Sleep-Inducing Peptide','DSIP peptide','Delta sleep peptide','DSIP neuropeptide',
    'Trp-Ala-Gly-Gly-Asp-Ala-Ser-Gly-Glu','Sleep peptide','Endogenous sleep modulator',
    'Neuropeptide sleep','Delta-wave sleep peptide','DSIP nonapeptide'
  ],
  studied_for = ARRAY[
    'Sleep research','Delta-wave sleep promotion','Sleep onset latency reduction',
    'Insomnia research','Stress modulation','HPA axis regulation','Hypothalamic regulation',
    'Cortisol regulation','Pain modulation','Opiate withdrawal research',
    'Circadian rhythm support','Antioxidant neuroprotection','Neuropeptide signaling research',
    'LH/GH sleep pulsatility','REM sleep research','Sleep architecture optimization'
  ],
  research_areas = ARRAY['sleep','cognitive','immune','longevity'],
  compound_class = 'Endogenous neuropeptide (9 amino acids) produced in hypothalamus',
  molecular_target = 'Hypothalamic receptors; modulates GH, LH, corticosteroid release; delta-wave EEG promotion'
WHERE slug = 'dsip';

-- ==========================================================================
-- 11. EPITHALON
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Epitalon','Epithalamin','Ala-Glu-Asp-Gly','AEDG peptide','Epithalon tetrapeptide',
    'Pineal peptide bioregulator','Epithalamine','Khavinson peptide',
    'Telomere elongation peptide','Anti-aging tetrapeptide','Epithalon 10mg',
    'Epitalon peptide'
  ],
  studied_for = ARRAY[
    'Telomere elongation','Anti-aging / longevity','Circadian rhythm regulation',
    'Antioxidant defense','Melatonin production stimulation','Pineal gland restoration',
    'Immune system enhancement in aging','Lifespan extension models',
    'Cancer prevention research','DNA repair','Neuroendocrine system regulation',
    'Oxidative stress reduction','Age-related disease prevention',
    'Sleep quality via melatonin','Skin anti-aging','Retinal cell protection',
    'Inflammatory cytokine modulation'
  ],
  research_areas = ARRAY['longevity','immune','sleep','cognitive'],
  compound_class = 'Synthetic tetrapeptide bioregulator derived from pineal gland epithalamin',
  molecular_target = 'Telomerase activation (TERT); pineal melatonin synthesis; antioxidant enzyme upregulation'
WHERE slug = 'epithalon';

-- ==========================================================================
-- 12. FOLLISTATIN
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'FST','Follistatin 344','FS-344','Follistatin-344','FST344',
    'Activin-binding protein','Myostatin inhibitor protein','Follistatin 288',
    'FS-288','Follistatin peptide','Anti-myostatin','Muscle growth factor',
    'Follistatin recombinant','FST-344 peptide'
  ],
  studied_for = ARRAY[
    'Muscle hypertrophy','Myostatin inhibition','Female fertility',
    'Lean muscle mass increase','Anti-myostatin therapy','Duchenne muscular dystrophy models',
    'Muscle wasting / sarcopenia research','Strength gain research','Body recomposition',
    'Ovarian follicle development','Reproductive hormone regulation','FSH inhibition',
    'Activin neutralization','Anabolic signaling amplification','Muscle fiber growth',
    'Fat mass reduction via muscle increase','Athletic performance research'
  ],
  research_areas = ARRAY['performance','hormonal','healing','tissue_repair'],
  compound_class = 'Endogenous glycoprotein / activin-binding protein (recombinant)',
  molecular_target = 'Myostatin (GDF-8) and activin A neutralization; prevents TGF-beta superfamily inhibition of muscle growth'
WHERE slug = 'follistatin';

-- ==========================================================================
-- 13. FOXO4-DRI
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'FOXO4 D-Retro-Inverso','FOXO4-DRI peptide','FOXO4 DRI','FOXO4 senolytic',
    'FOXO4-p53 disruptor','Senolytic peptide','D-retro-inverso FOXO4',
    'Senescent cell clearance peptide','FOXO4 peptide','Anti-senescence peptide',
    'Healthspan peptide','Age reversal peptide'
  ],
  studied_for = ARRAY[
    'Senolytics / senescent cell clearance','Aging / healthspan extension',
    'Chemotherapy-induced senescence reversal','Physical fitness restoration in aging models',
    'Hair follicle rejuvenation in aging','Kidney function in aging models',
    'Liver health in aging','Inflammatory burden reduction',
    'SASP (senescence-associated secretory phenotype) suppression',
    'p53-FOXO4 interaction disruption','Apoptosis induction in senescent cells',
    'Age-related tissue dysfunction','Frailty research','Longevity extension research'
  ],
  research_areas = ARRAY['longevity','immune','tissue_repair'],
  compound_class = 'D-retro-inverso peptide; protease-resistant cell-penetrating senolytic',
  molecular_target = 'FOXO4-p53 protein-protein interaction; disrupts pro-survival signaling in senescent cells, inducing selective apoptosis'
WHERE slug = 'foxo4-dri';

-- ==========================================================================
-- 14. GHK-Cu (Copper Peptide)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Copper peptide','Glycyl-L-histidyl-L-lysine copper','GHK-Copper','GHK Cu',
    'Copper tripeptide-1','Copper peptide GHK','Lamin','Iamin','Tricomin',
    'Folligen','Skin copper peptide','GHK cupric complex','CuGHK',
    'Glycyl histidyl lysine','Collaxyl','Copper peptide serum'
  ],
  studied_for = ARRAY[
    'Wound healing','Skin anti-aging','Hair loss research','Antioxidant / anti-inflammatory',
    'Collagen synthesis stimulation','Elastin production','Glycosaminoglycan synthesis',
    'Dermal regeneration','Skin tightening','Wrinkle reduction',
    'Melanocyte stimulation / hair pigmentation','Scalp health','Alopecia models',
    'Nerve regeneration','Lung tissue repair','GI tract healing',
    'Bone density support','Angiogenesis','Antioxidant enzyme upregulation',
    'Scar reduction','Skin barrier restoration','Post-procedure skin recovery',
    'UV damage repair research','Anti-inflammatory skin research'
  ],
  research_areas = ARRAY['cosmetic','healing','tissue_repair','bone_joint','immune'],
  compound_class = 'Naturally occurring copper-binding tripeptide (Gly-His-Lys + Cu2+)',
  molecular_target = 'Extracellular matrix remodeling via MMP/TIMP balance; TGF-beta modulation; antioxidant enzyme (SOD, catalase) upregulation; VEGF and FGF stimulation'
WHERE slug = 'ghk-cu';

-- ==========================================================================
-- 15. GHRP-2
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Pralmorelin','GHRP2','KP-102','Growth Hormone Releasing Peptide 2',
    'GHRP-2 peptide','GH-releasing peptide 2','Hexarelin analog shorter',
    'GH secretagogue peptide 2','D-Ala-D-beta-Nal-Ala-Trp-D-Phe-Lys-NH2',
    'Pralmorelin dihydrochloride','KP102'
  ],
  studied_for = ARRAY[
    'GH deficiency diagnosis','GH secretagogue research','Growth hormone stimulation',
    'IGF-1 elevation','Pituitary function testing','Anti-aging via GH axis',
    'Body composition / lean mass','Fat loss research','Appetite stimulation',
    'Muscle growth and repair','Bone density via GH','Recovery acceleration',
    'Ghrelin axis research','GH pulse amplitude','Adult GH deficiency models',
    'Metabolic rate improvement','Sleep quality via GH','Cardiac function research'
  ],
  research_areas = ARRAY['performance','longevity','metabolic'],
  compound_class = 'Synthetic hexapeptide GH secretagogue (GHRP); ghrelin mimetic',
  molecular_target = 'GHS-R1a (ghrelin receptor) agonist on pituitary somatotrophs and hypothalamus; stimulates GH and ghrelin'
WHERE slug = 'ghrp-2';

-- ==========================================================================
-- 16. GHRP-6
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'GHRP6','Growth Hormone Releasing Hexapeptide','GHRP-6 peptide',
    'His-D-Trp-Ala-Trp-D-Phe-Lys-NH2','GH-releasing hexapeptide',
    'Growth hormone secretagogue hexapeptide','GH releasing peptide 6',
    'GHRP 6','Hexarelin precursor','Hunger peptide'
  ],
  studied_for = ARRAY[
    'GH release stimulation','Appetite stimulation / hunger research',
    'GI motility research','GH secretagogue research','IGF-1 elevation',
    'Muscle growth via GH axis','Fat loss via GH','Body composition research',
    'Ghrelin axis signaling','Pituitary GH function testing','Anti-aging via GH',
    'Gastric motility and emptying','Cytoprotective GI effects',
    'GH pulse amplitude research','Lean mass increase'
  ],
  research_areas = ARRAY['performance','metabolic','gut_health'],
  compound_class = 'Synthetic hexapeptide GH secretagogue (GHRP); first-generation ghrelin mimetic',
  molecular_target = 'GHS-R1a (ghrelin receptor) agonist; stimulates pituitary GH release and endogenous ghrelin; strong appetite/hunger signal'
WHERE slug = 'ghrp-6';

-- ==========================================================================
-- 17. GLOW STACK
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'GLOW stack','TB500 BPC157 GHK-Cu stack','TB-500 BPC-157 GHK-Cu blend',
    'Skin regeneration stack','Beauty peptide stack','Anti-aging skin stack',
    'Glow peptide blend','Cosmetic healing stack','Dermal regeneration stack',
    'Skin healing triple stack','TB BPC GHK stack'
  ],
  studied_for = ARRAY[
    'Skin anti-aging / regeneration','Wound healing acceleration',
    'Collagen and elastin synthesis','Skin tightening and firmness',
    'Hair growth support','Dermal tissue repair','Wrinkle reduction',
    'Post-procedure skin recovery','Scar minimization','Angiogenesis for skin',
    'Combined systemic and local tissue repair','Skin brightening',
    'Anti-inflammatory skin health','Comprehensive cosmetic healing'
  ],
  research_areas = ARRAY['cosmetic','healing','tissue_repair'],
  compound_class = 'Peptide stack: TB-500 + BPC-157 + GHK-Cu',
  molecular_target = 'Triple-pathway: actin sequestration/VEGF (TB-500) + NO/EGF/VEGF (BPC-157) + MMP/TGF-beta/antioxidant (GHK-Cu)'
WHERE slug = 'glow';

-- ==========================================================================
-- 18. GLUTATHIONE
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'GSH','L-Glutathione','Reduced glutathione','Gamma-glutamylcysteinylglycine',
    'Glutathione reduced','L-GSH','Glutathiol','Tathion','Isethion','Glutatione',
    'Master antioxidant','Endogenous antioxidant tripeptide','GSH peptide',
    'Liver antioxidant','Glu-Cys-Gly'
  ],
  studied_for = ARRAY[
    'Antioxidant therapy','Detoxification / phase II liver detox','Liver protection',
    'Skin brightening / whitening','Oxidative stress reduction','Immune system support',
    'Heavy metal chelation','Aging and cellular senescence','Mitochondrial protection',
    'Cancer adjuvant research','Neurodegeneration models','Alcohol-induced liver damage',
    'Athletic recovery and oxidative stress','Drug toxicity protection',
    'Glutathione deficiency','Cystic fibrosis models','Parkinson''s research',
    'Insulin resistance models','Anti-inflammatory'
  ],
  research_areas = ARRAY['immune','longevity','metabolic','mitochondrial','cosmetic'],
  compound_class = 'Endogenous tripeptide (Glu-Cys-Gly); master intracellular antioxidant',
  molecular_target = 'Reactive oxygen species scavenging; glutathione peroxidase/transferase substrate; Nrf2 pathway; melanin synthesis inhibition (tyrosinase)'
WHERE slug = 'glutathione';

-- ==========================================================================
-- 19. HCG (Human Chorionic Gonadotropin)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Human Chorionic Gonadotropin','Choriogonadotropin alfa','hCG','HCG hormone',
    'Pregnyl','Novarel','Profasi','Ovidrel','Choragon','Choriomon',
    'Luteinizing hormone analog','LH analog','hCG injection',
    'Gonadotropin fertility drug','Testosterone support peptide','hCG for TRT'
  ],
  studied_for = ARRAY[
    'Male hypogonadism','Fertility treatment','TRT support / testicular maintenance',
    'Ovulation induction (women)','Testosterone production stimulation',
    'Spermatogenesis support','Cryptorchidism (undescended testes)','Luteal phase support',
    'IVF / ART ovulation trigger','LH substitute therapy',
    'Testicular atrophy prevention on TRT','Leydig cell stimulation',
    'Delayed puberty research','Pituitary LH deficiency models',
    'Testosterone deficiency without LH elevation'
  ],
  research_areas = ARRAY['hormonal','sexual_health'],
  compound_class = 'Glycoprotein gonadotropin hormone (recombinant/extracted); LH analog',
  molecular_target = 'LH/hCG receptor (LHCGR) on Leydig cells (testes) and granulosa/luteal cells (ovary); stimulates testosterone and progesterone synthesis'
WHERE slug = 'hcg';

-- ==========================================================================
-- 20. HEXARELIN
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Examorelin','EP-23905','MF-6003','Hexarelin peptide','His-D-2-MeTrp-Ala-Trp-D-Phe-Lys',
    'Growth hexapeptide','Cardioprotective GHRP','GHRP-6 analog','His6-hexarelin',
    'Cardiovascular GH peptide','Hexarelin acetate'
  ],
  studied_for = ARRAY[
    'GH secretagogue research','Cardiac protection / cardioprotection','Cytoprotection',
    'IGF-1 elevation','Body composition / lean mass','Anti-aging via GH axis',
    'Fat loss via GH','Heart failure models','Ischemia reperfusion research',
    'Pituitary GH function','GHS-R independent cardiac effects','Muscle growth research',
    'Bone density via GH','Recovery and repair','Ghrelin axis signaling'
  ],
  research_areas = ARRAY['performance','longevity','metabolic'],
  compound_class = 'Synthetic hexapeptide GH secretagogue (GHRP); potent ghrelin mimetic with cardiac-specific effects',
  molecular_target = 'GHS-R1a (ghrelin receptor); also acts on CD36 scavenger receptor on cardiomyocytes for GH-independent cardioprotection'
WHERE slug = 'hexarelin';

-- ==========================================================================
-- 21. HGH FRAGMENT 176-191
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'HGH Frag','AOD Fragment','Frag 176-191','HGH Fragment','Fragment 176-191',
    'HGH 176-191','Growth hormone fragment 176-191','GH fragment 176-191',
    'Lipolytic GH fragment','Fat-loss fragment','Frag176-191',
    'C-terminal HGH fragment 176-191','Anti-obesity GH fragment'
  ],
  studied_for = ARRAY[
    'Lipolysis / fat loss','Adipose reduction','Visceral fat reduction',
    'Body composition improvement','Subcutaneous fat burning','Fat oxidation',
    'Anti-obesity research','Weight management','Metabolic rate enhancement',
    'Fat-loss peptide research','Abdominal fat research','Beta-3 adrenergic lipolysis',
    'Lean mass preservation during fat loss','GH-fragment weight research'
  ],
  research_areas = ARRAY['metabolic','weight_management'],
  compound_class = 'Synthetic fragment of HGH C-terminus (residues 176-191)',
  molecular_target = 'Beta-3 adrenergic receptors; stimulates lipolysis without GH receptor binding; no IGF-1 elevation'
WHERE slug = 'hgh-fragment-176-191';

-- ==========================================================================
-- 22. HMG (Human Menopausal Gonadotropin)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Human Menopausal Gonadotropin','Menotropin','Menopur','Repronex','Pergonal',
    'Humegon','Menogon','FSH LH blend','HMG injection','Gonadotropin blend',
    'FSH/LH combination','Urinary gonadotropin extract','HMG fertility drug'
  ],
  studied_for = ARRAY[
    'IVF / ART ovulation induction','Controlled ovarian hyperstimulation',
    'Spermatogenesis support in males','Hypogonadotropic hypogonadism',
    'Female infertility treatment','Male infertility research','Follicle development',
    'Polycystic ovary syndrome (PCOS) research','LH + FSH combined stimulation',
    'Fertility preservation research','Assisted reproduction research'
  ],
  research_areas = ARRAY['hormonal','sexual_health'],
  compound_class = 'Purified urinary extract containing FSH + LH gonadotropins',
  molecular_target = 'FSH receptor (FSHR) on granulosa/Sertoli cells + LH/hCG receptor (LHCGR) on theca/Leydig cells; dual gonadal stimulation'
WHERE slug = 'hmg';

-- ==========================================================================
-- 23. IGF-1 LR3
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Long-Arg3 IGF-I','Insulin-like Growth Factor 1 LR3','IGF1 LR3','IGF-1 LR3',
    'Long R3 IGF-1','Long R3 insulin-like growth factor','IGF LR3','LR3 IGF-1',
    'Des(1-3)-IGF-1 long analog','IGF1-LR3 recombinant','Anabolic growth factor peptide',
    'Muscle growth factor IGF','Somatomedin C analog'
  ],
  studied_for = ARRAY[
    'Muscle growth / hypertrophy','Anabolic research','GH axis signaling',
    'Lean mass increase','Satellite cell activation','Muscle protein synthesis',
    'Anti-catabolic research','Fat loss via anabolic signaling','Bone density support',
    'Tendon collagen synthesis','Nerve growth and repair','Cartilage repair',
    'Glucose uptake / insulin sensitivity','Cell proliferation research',
    'GH-independent anabolic pathway','Recovery and repair acceleration',
    'Body recomposition research'
  ],
  research_areas = ARRAY['performance','tissue_repair','bone_joint','metabolic'],
  compound_class = 'Long-acting recombinant IGF-1 analog (Arg3 substitution, 13 N-terminal extension)',
  molecular_target = 'IGF-1 receptor (IGF1R); PI3K/Akt/mTOR signaling; satellite cell proliferation; reduced IGFBP binding = extended half-life'
WHERE slug = 'igf-1-lr3';

-- ==========================================================================
-- 24. IPAMORELIN
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'NNC 26-0161','NNC26-0161','Ipamorelin acetate','GHRP-1a analog','Selective GHRP',
    'Ipamorelin peptide','Growth hormone secretagogue ipamorelin','IPA peptide',
    'Aib-His-D-2-Nal-D-Phe-Lys-NH2','Pentapeptide GHS'
  ],
  studied_for = ARRAY[
    'GH secretagogue research','Anti-aging / longevity via GH axis','Body composition improvement',
    'Lean muscle gain','Fat loss via GH','Sleep quality / GH rhythm','Recovery',
    'Bone density via GH','IGF-1 elevation','Pulsatile GH release simulation',
    'Stacked with CJC-1295 (no DAC)','GI motility research',
    'Metabolic rate improvement','Collagen synthesis via GH','Athletic performance'
  ],
  research_areas = ARRAY['performance','longevity','metabolic','bone_joint','sleep'],
  compound_class = 'Selective synthetic pentapeptide GH secretagogue (GHRP); minimal cortisol/prolactin side effects',
  molecular_target = 'GHS-R1a (ghrelin receptor) agonist; highly selective for pituitary GH release without significant ACTH/cortisol elevation'
WHERE slug = 'ipamorelin';

-- ==========================================================================
-- 25. KISSPEPTIN-10
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Kisspeptin','Metastin','KP-10','Kisspeptin 10','KP10','Metastin 45-54',
    'KISS1 peptide fragment','Kisspeptin receptor agonist','GnRH pulse stimulator',
    'Reproductive neuropeptide','Kisspeptin-10 acetate','KISS1R agonist'
  ],
  studied_for = ARRAY[
    'Reproductive axis research','LH/FSH stimulation','Fertility treatment',
    'GnRH pulse regulation','Hypogonadotropic hypogonadism models',
    'Male testosterone stimulation','Female ovulation stimulation',
    'Pubertal timing research','Hormonal axis restoration',
    'Hypothalamic amenorrhea models','Polycystic ovary syndrome (PCOS) research',
    'Sexual maturation research','LH surge induction','Spermatogenesis support',
    'HPA-HPG axis interaction'
  ],
  research_areas = ARRAY['hormonal','sexual_health'],
  compound_class = 'Endogenous neuropeptide (KISS1 gene product fragment); GPR54/KISS1R agonist',
  molecular_target = 'GPR54 / KISS1R on GnRH neurons in hypothalamus; stimulates LH/FSH via pulsatile GnRH release'
WHERE slug = 'kisspeptin-10';

-- ==========================================================================
-- 26. KLOW STACK
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'KLOW stack','TB10 BPC10 GHK50 KPV10','KLOW blend','Low-dose healing stack',
    'TB500 BPC157 GHK-Cu KPV stack','Comprehensive healing peptide stack',
    'Quad healing stack','KLOW peptide combination','Low-dose peptide stack'
  ],
  studied_for = ARRAY[
    'Comprehensive healing stack','Multi-target tissue repair','GI healing and inflammation',
    'Skin regeneration and anti-aging','Anti-inflammatory across tissues',
    'Wound healing acceleration','Tendon and ligament repair',
    'Combined immune and tissue support','Gut health restoration',
    'Systemic recovery protocol','Low-dose peptide synergy research',
    'Collagen synthesis multi-pathway','Angiogenesis and tissue perfusion'
  ],
  research_areas = ARRAY['healing','tissue_repair','gut_health','pain_inflammation','cosmetic','immune'],
  compound_class = 'Multi-peptide stack: TB-500 + BPC-157 + GHK-Cu + KPV (low-dose blend)',
  molecular_target = 'Quad-pathway: actin/VEGF (TB-500) + NO/EGF (BPC-157) + MMP/antioxidant (GHK-Cu) + MC1R/NF-kB (KPV)'
WHERE slug = 'klow';

-- ==========================================================================
-- 27. KPV
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Lys-Pro-Val','Alpha-MSH tripeptide core','MSH fragment','KPV peptide',
    'Alpha-melanocyte-stimulating hormone C-terminal tripeptide',
    'Anti-inflammatory tripeptide','GI anti-inflammatory peptide',
    'MSH-derived tripeptide','KPV tripeptide','Immunomodulatory tripeptide',
    'IBD peptide research','Mucosal healing peptide'
  ],
  studied_for = ARRAY[
    'GI inflammation / IBD research','Ulcerative colitis models','Crohn''s disease models',
    'Skin inflammation','Wound healing','Immune modulation',
    'NF-kB pathway inhibition','Anti-inflammatory cytokine reduction',
    'Mucosal barrier integrity','Gut health restoration',
    'Psoriasis research','Eczema research','Colitis models',
    'Melanocortin receptor anti-inflammatory','Systemic inflammation reduction',
    'Oral peptide delivery research'
  ],
  research_areas = ARRAY['gut_health','immune','healing','pain_inflammation','cosmetic'],
  compound_class = 'Tripeptide C-terminal fragment of alpha-MSH (melanocyte-stimulating hormone)',
  molecular_target = 'MC1R / melanocortin receptors; NF-kB inhibition; reduces TNF-alpha, IL-1beta, IL-6 production; mucosal protection'
WHERE slug = 'kpv';

-- ==========================================================================
-- 28. L-CARNITINE
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Carnitine','Levocarnitine','ALCAR','Acetyl-L-Carnitine','L-Carnitine tartrate',
    'Propionyl-L-Carnitine','L-Carnitine fumarate','Carnitor','VitaCarn',
    'L-Carnitine injection','Levacecarnine','Beta-hydroxy-gamma-trimethylaminobutyric acid',
    'Carnitine base','Mitochondrial transport factor','Fat transport molecule'
  ],
  studied_for = ARRAY[
    'Fat oxidation / fatty acid transport','Energy metabolism','Exercise performance',
    'Cognitive support / brain energy','Carnitine deficiency','Peripheral artery disease',
    'Cardiovascular disease models','Male infertility / sperm motility',
    'Insulin resistance models','Dialysis-related carnitine deficiency',
    'Weight management adjunct','Muscle recovery','Fatigue reduction',
    'Mitochondrial function support','Hepatic fat metabolism',
    'Athletic endurance enhancement','Neuroprotection research'
  ],
  research_areas = ARRAY['metabolic','performance','mitochondrial','cognitive'],
  compound_class = 'Conditionally essential amino acid derivative (betaine analog); mitochondrial fatty acid transport molecule',
  molecular_target = 'Carnitine palmitoyltransferase I/II (CPT1/CPT2); transports long-chain fatty acids into mitochondrial matrix for beta-oxidation'
WHERE slug = 'l-carnitine';

-- ==========================================================================
-- 29. LEMON BOTTLE
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Lemon Bottle injection','Riboflavin bromelain lipolytic blend','Lemon bottle fat dissolve',
    'Lemon bottle aesthetic injection','Fat dissolving injection','Lipolytic cocktail',
    'Injectable fat reduction blend','Lemon Bottle lipolysis','Phosphatidylcholine blend',
    'Aesthetic lipolytic injection','Body sculpting injection','Spot fat reduction injection'
  ],
  studied_for = ARRAY[
    'Localized fat reduction (aesthetic)','Submental fat dissolving (double chin)',
    'Body contouring','Non-surgical liposuction alternative','Facial fat reduction',
    'Spot reduction research','Lipid emulsion aesthetic','Phosphatidylcholine lipolysis',
    'Deoxycholate fat dissolving','Aesthetic medicine injection',
    'Lipolysis cocktail research'
  ],
  research_areas = ARRAY['metabolic','cosmetic','weight_management'],
  compound_class = 'Proprietary lipolytic aesthetic blend (riboflavin, bromelain, lecithin, carnitine)',
  molecular_target = 'Adipocyte membrane disruption and fatty acid release; phospholipase activation; localized lipolysis'
WHERE slug = 'lemon-bottle';

-- ==========================================================================
-- 30. LIPO-C
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'MIC blend','Lipotropic injection','Methionine Inositol Choline injection',
    'Lipotropic cocktail','MIC injection','LIPO-C injection','Slim shot',
    'Weight loss injection blend','Fat burner injection','Methionine inositol choline carnitine',
    'Lipotropic weight management','Liver detox injection','B12 lipotropic blend'
  ],
  studied_for = ARRAY[
    'Weight-management adjunct','Fat metabolism support','Liver lipid export',
    'Hepatic steatosis research','Methyl donor support','Choline-deficiency liver research',
    'Inositol insulin sensitization','Carnitine fat oxidation adjunct',
    'Energy metabolism enhancement','Detoxification support',
    'Body composition research','Obesity adjunct therapy'
  ],
  research_areas = ARRAY['metabolic','weight_management'],
  compound_class = 'Lipotropic injection blend (Methionine + Inositol + Choline +/- Carnitine/B12)',
  molecular_target = 'Hepatic lipid metabolism; choline as phosphatidylcholine precursor; methionine as methyl donor; inositol as PI3K second messenger'
WHERE slug = 'lipo-c';

-- ==========================================================================
-- 31. LL-37
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Cathelicidin','hCAP-18 fragment','CAP-18','LL37','hCAP18',
    'Cathelicidin antimicrobial peptide','Human cathelicidin','CAMP peptide',
    'Host defense peptide LL-37','Innate immunity peptide',
    'Antimicrobial host defense peptide','Wound healing antimicrobial peptide',
    'LL-37 peptide','Cathelicidin LL-37'
  ],
  studied_for = ARRAY[
    'Antimicrobial / antibiofilm research','Wound healing','Innate immunity modulation',
    'Autoimmune disease research','Bacterial biofilm disruption','MRSA research',
    'Viral infection defense models','Fungal infection research',
    'Gut microbiome modulation','Inflammatory bowel disease models',
    'Cancer immunology research','Lung infection / cystic fibrosis models',
    'Skin infection treatment research','Angiogenesis promotion',
    'Wound re-epithelialization','Sepsis research','Immune cell recruitment',
    'Chemotaxis of neutrophils and monocytes'
  ],
  research_areas = ARRAY['immune','healing','gut_health','pain_inflammation','tissue_repair'],
  compound_class = 'Endogenous cationic host defense peptide (cathelicidin family); 37-residue C-terminal fragment of hCAP-18',
  molecular_target = 'Bacterial membrane disruption; TLR4 and FPRL1 receptor signaling; EGFR transactivation; immunomodulatory cytokine network'
WHERE slug = 'll-37';

-- ==========================================================================
-- 32. MELATONIN
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'N-acetyl-5-methoxytryptamine','Melatonin hormone','Pineal hormone',
    'Mel','Melatol','Circadin','Slenyto','Valdoxan precursor','Sleep hormone',
    'Darkness hormone','Chronobiotic','Pineal gland hormone',
    'MEL','Melatonin acetate','N-Acetylmelatonin precursor'
  ],
  studied_for = ARRAY[
    'Sleep onset / insomnia','Circadian rhythm entrainment','Jet-lag disorders',
    'Shift work sleep disorder','Antioxidant / neuroprotection research',
    'Anti-aging / longevity','Immune system modulation','Cancer adjuvant research',
    'Alzheimer''s / neurodegeneration models','Sepsis / intensive care research',
    'Gastrointestinal motility','Mitochondrial protection','Blood pressure regulation',
    'Seasonal affective disorder (SAD) research','Pediatric sleep disorders',
    'Delayed sleep phase syndrome','REM behavior disorder'
  ],
  research_areas = ARRAY['sleep','longevity','immune','cognitive','mitochondrial'],
  compound_class = 'Endogenous indoleamine neurohormone produced by the pineal gland',
  molecular_target = 'MT1 and MT2 melatonin receptors (MTNR1A/MTNR1B); ROR nuclear receptors; ROS scavenging; mitochondrial membrane stabilization'
WHERE slug = 'melatonin';

-- ==========================================================================
-- 33. MOTS-c
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Mitochondrial ORF of 12S rRNA type-c','MOTS c','MOTS-c peptide','Mitochondrial peptide MOTS-c',
    'Mitokine MOTS-c','12S rRNA-encoded peptide','Exercise mimetic peptide',
    'Mitochondrial-derived peptide','Metabolic MOTS-c','MRFA16 peptide analog'
  ],
  studied_for = ARRAY[
    'Metabolic homeostasis','Insulin resistance / obesity','Exercise-mimetic research',
    'AMPK activation','Glucose metabolism','Skeletal muscle uptake',
    'Longevity and aging','Inflammation regulation','Mitochondrial stress response',
    'Obesity research','Type 2 diabetes models','Menopause-related metabolic changes',
    'NAD metabolism','Folate-methionine cycle','Mitochondrial communication',
    'Physical endurance research','Metabolic flexibility'
  ],
  research_areas = ARRAY['metabolic','mitochondrial','performance','weight_management','longevity'],
  compound_class = 'Mitochondrial-derived peptide (MDP) encoded within 12S rRNA of mitochondrial genome',
  molecular_target = 'AMPK activation; folate-methionine cycle; AICAR-independent AMPK signaling; nuclear translocation for gene expression regulation'
WHERE slug = 'mots-c';

-- ==========================================================================
-- 34. MT-1 (Afamelanotide)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Afamelanotide','Scenesse','NDP-MSH','Melanotan I','Melanotan 1','MT1',
    '[Nle4-D-Phe7]-alpha-MSH','Norleucine 4 D-phenylalanine 7 alpha-MSH analog',
    'Photoprotective peptide','Tanning peptide','EPP treatment peptide',
    'MC1R agonist peptide','Melanocortin 1 agonist'
  ],
  studied_for = ARRAY[
    'Erythropoietic protoporphyria (EPP) (FDA/EMA approved)','Photodermatoses research',
    'Solar urticaria','Polymorphous light eruption (PLE)','UV light protection',
    'Melanin production stimulation','Skin darkening / tanning research',
    'Squamous cell carcinoma prevention research','Libido research (MC4R pathway)',
    'Melanocortin system research','Vitiligo models','Inflammatory skin disease models'
  ],
  research_areas = ARRAY['cosmetic','immune','sexual_health'],
  compound_class = 'Synthetic alpha-MSH analog with [Nle4,D-Phe7] substitutions; MC1R-selective agonist',
  molecular_target = 'MC1R (melanocortin-1 receptor) on melanocytes; stimulates eumelanin synthesis and photoprotection'
WHERE slug = 'mt-1';

-- ==========================================================================
-- 35. NAD+
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Nicotinamide adenine dinucleotide','NAD','NAD+ coenzyme','NAD plus',
    'Beta-nicotinamide adenine dinucleotide','NAD IV therapy','NAD infusion',
    'Oxidized NAD','Coenzyme I','DPN (diphosphopyridine nucleotide)',
    'NAD supplement','NADH precursor','Cellular energy coenzyme',
    'Sirtuin activator cofactor','Anti-aging NAD'
  ],
  studied_for = ARRAY[
    'Aging / cellular senescence','Mitochondrial / metabolic dysfunction',
    'Neurodegeneration models','Sirtuin activation (SIRT1-7)','DNA repair (PARP activation)',
    'Addiction / substance withdrawal research','Chronic fatigue / energy restoration',
    'Alzheimer''s and Parkinson''s research','Alcohol use disorder detox',
    'Metabolic syndrome','Insulin resistance','Cardiovascular disease models',
    'Exercise performance and endurance','Inflammation modulation',
    'NAD metabolism optimization','Longevity research','NAMPT upregulation',
    'Cognitive enhancement','Depression research'
  ],
  research_areas = ARRAY['longevity','metabolic','mitochondrial','cognitive','immune'],
  compound_class = 'Essential coenzyme (dinucleotide); critical redox electron carrier in all living cells',
  molecular_target = 'Sirtuin deacetylases (SIRT1-7); PARP1 for DNA repair; CD38/CD157 signaling; NADH/NAD+ redox balance in mitochondria'
WHERE slug = 'nad-plus';

-- ==========================================================================
-- 36. OXYTOCIN
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Pitocin','Syntocinon','Oxytocin Acetate','Oxytocin hormone',
    'Love hormone','Bonding hormone','Trust hormone','Neuropeptide oxytocin',
    'Cys-Tyr-Ile-Gln-Asn-Cys-Pro-Leu-Gly-NH2','OXT','Uterocon',
    'Intranasal oxytocin','Social bonding peptide'
  ],
  studied_for = ARRAY[
    'Labor induction / postpartum hemorrhage','Milk let-down / lactation',
    'Social cognition research (intranasal)','Autism spectrum disorder research',
    'Anxiety and stress reduction research','Trust and social bonding research',
    'Erectile dysfunction research','Female sexual dysfunction research',
    'PTSD / trauma research','Addiction research','Eating disorder research',
    'Pair bonding / monogamy research','Depression models','Schizophrenia research',
    'Wound healing via oxytocin receptors','Uterine contraction induction',
    'Male sexual arousal research'
  ],
  research_areas = ARRAY['sexual_health','cognitive','hormonal','immune'],
  compound_class = 'Endogenous hypothalamic nonapeptide neurohormone; posterior pituitary release',
  molecular_target = 'Oxytocin receptor (OXTR); Gq/cAMP signaling; amygdala fear response modulation; uterine smooth muscle contraction'
WHERE slug = 'oxytocin';

-- ==========================================================================
-- 37. PINEALON
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'EDR','Glu-Asp-Arg','Pinealon peptide','EDR tripeptide',
    'Neuroprotective tripeptide','Pineal bioregulator','Khavinson pineal peptide',
    'Glutamyl aspartyl arginine','EDR bioregulator','Brain peptide bioregulator',
    'Neuronal aging peptide','Pineal gland peptide'
  ],
  studied_for = ARRAY[
    'Neuroprotection','Neuronal aging','Cognition / memory research',
    'Retinal cell neuroprotection','Ischemia-induced brain damage models',
    'Parkinson''s research','Age-related cognitive decline',
    'Sleep regulation via pineal','Circadian rhythm support',
    'DNA oxidative damage protection','Brain antioxidant research',
    'Glaucoma / ocular neurodegeneration research','Longevity via neuroprotection',
    'Stress-induced neurotoxicity models'
  ],
  research_areas = ARRAY['longevity','cognitive','sleep'],
  compound_class = 'Synthetic tripeptide bioregulator (Glu-Asp-Arg) derived from pineal gland peptide complex',
  molecular_target = 'Epigenetic regulation of neuronal genes; antioxidant enzyme induction; serotonin/melatonin pathway modulation'
WHERE slug = 'pinealon';

-- ==========================================================================
-- 38. PT-141 (Bremelanotide)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Bremelanotide','Vyleesi','PT 141','PT141','Melanocortin sexual peptide',
    'MC4R agonist peptide','Libido peptide','Sexual arousal peptide',
    'Cyclic lactam MSH analog','Melanocortin-4 receptor agonist',
    'Hypoactive sexual desire peptide','HSDD treatment','Female sexual dysfunction peptide',
    'Bremelanotide acetate'
  ],
  studied_for = ARRAY[
    'Hypoactive sexual desire disorder (HSDD) in premenopausal women (FDA approved)',
    'Erectile dysfunction research (historical)','Female sexual arousal disorder',
    'Male sexual dysfunction research','Libido enhancement','Sexual arousal stimulation',
    'Melanocortin system sexual research','Orgasmic dysfunction research',
    'Pornography-induced erectile dysfunction models',
    'Testosterone-independent sexual arousal','CNS-mediated sexual response',
    'Female orgasm research'
  ],
  research_areas = ARRAY['sexual_health'],
  compound_class = 'Cyclic heptapeptide melanocortin receptor agonist; Melanotan II analog without linear structure',
  molecular_target = 'MC4R (melanocortin-4 receptor) in hypothalamus; dopaminergic sexual arousal pathway; also MC1R (minor)'
WHERE slug = 'pt-141';

-- ==========================================================================
-- 39. RETATRUTIDE
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'LY-3437943','Triple-G','Retatrutide peptide','LY3437943','Triple agonist obesity drug',
    'GIP GLP-1 glucagon triple agonist','Eli Lilly triple agonist','Triple incretin agonist',
    'Retatrutide LY3437943','Tri-agonist obesity peptide'
  ],
  studied_for = ARRAY[
    'Obesity / overweight','Type 2 diabetes','Liver fat / MASLD / NAFLD',
    'Triple agonist weight loss','GLP-1 GIP glucagon combined therapy',
    'Metabolic syndrome','Insulin resistance','HbA1c reduction',
    'Cardiovascular risk reduction','Non-alcoholic steatohepatitis (NASH)',
    'Body weight reduction vs placebo','Appetite suppression triple pathway',
    'Lean mass preservation during weight loss','Obstructive sleep apnea in obesity'
  ],
  research_areas = ARRAY['metabolic','weight_management'],
  compound_class = 'Synthetic triple agonist: GIP receptor + GLP-1 receptor + glucagon receptor',
  molecular_target = 'GIPR (GIP receptor) + GLP-1R (GLP-1 receptor) + GCGR (glucagon receptor); triple incretin/glucagon signaling for maximal metabolic effect'
WHERE slug = 'retatrutide';

-- ==========================================================================
-- 40. SELANK
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'TP-7','Selank peptide','Thr-Lys-Pro-Arg-Pro-Gly-Pro tuftsin analog',
    'Anxiolytic peptide','Russian anti-anxiety peptide','Tuftsin analog',
    'Anxioselective peptide','Nootropic peptide Selank','GABA-modulating peptide',
    'Adaptogen peptide Selank','Selank nasal spray'
  ],
  studied_for = ARRAY[
    'Generalized anxiety disorder research','Stress modulation','Cognition / attention / focus',
    'Memory enhancement','Anxiety reduction without sedation','BDNF upregulation',
    'Serotonin system modulation','Dopamine modulation','GABAergic modulation',
    'Immune modulation via tuftsin analog','Antidepressant research',
    'Alcohol withdrawal research','ADHD research','Nootropic research',
    'Neuroplasticity','Adaptive stress response'
  ],
  research_areas = ARRAY['cognitive','immune','sleep'],
  compound_class = 'Synthetic heptapeptide anxiolytic / nootropic; tuftsin analog (Thr-Lys-Pro-Arg-Pro-Gly-Pro)',
  molecular_target = 'Enkephalinase inhibition; GABA-A receptor modulation; BDNF upregulation; serotonin/dopamine pathway; T-cell tuftsin receptor'
WHERE slug = 'selank';

-- ==========================================================================
-- 41. SEMAGLUTIDE
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Ozempic','Wegovy','Rybelsus','NN9535','Semaglutide peptide','GLP-1 agonist semaglutide',
    'Novo Nordisk GLP-1','Semaglutide injection','Semaglutide oral','GLP-1 weight loss drug',
    'Weight loss injection semaglutide','Diabetes GLP-1 semaglutide','Semglutide',
    'Semagluide','Semaglutade','Ozempic shot','Wegovy injection','once-weekly GLP-1'
  ],
  studied_for = ARRAY[
    'Type 2 diabetes management','Chronic weight management / obesity','Cardiovascular risk reduction',
    'HbA1c lowering','Appetite suppression','Body weight reduction',
    'Non-alcoholic fatty liver disease (NAFLD/MASH)','Kidney disease in diabetes (SELECT trial)',
    'Obstructive sleep apnea','Alzheimer''s / neurodegeneration research',
    'Addiction / substance use disorder research','Cardiovascular outcomes improvement',
    'Insulin resistance','Metabolic syndrome','Pre-diabetes prevention',
    'Polycystic ovary syndrome (PCOS) research','GLP-1 receptor agonist research'
  ],
  research_areas = ARRAY['metabolic','weight_management'],
  compound_class = 'GLP-1 receptor agonist; fatty-acid conjugated 31-amino-acid peptide analog of human GLP-1',
  molecular_target = 'GLP-1 receptor (GLP1R); cAMP/PKA signaling; pancreatic beta-cell insulin secretion; hypothalamic appetite suppression; gastric emptying delay'
WHERE slug = 'semaglutide';

-- ==========================================================================
-- 42. SEMAX
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Semax peptide','ACTH 4-7 PGP','Met-Glu-His-Phe-Pro-Gly-Pro','Semax nasal spray',
    'ACTH analog nootropic','Heptapeptide nootropic','Russian nootropic peptide',
    'Pro-Gly-Pro analog ACTH','Semax cognitive peptide','Semax neuroprotective',
    'N-acetylated Semax','Semax 0.1% nasal','Semax 1% nasal'
  ],
  studied_for = ARRAY[
    'Ischemic stroke recovery','Cognition / memory enhancement','Optic nerve disorders',
    'CNS disorders research','ADHD research','BDNF upregulation',
    'Neuroprotection','Anxiety reduction','Depression models',
    'Transient ischemic attack (TIA) models','Serotonin upregulation',
    'Dopamine enhancement','Focus and attention research','Immune modulation',
    'Melanocortin system cognitive effects','Neurogenesis research',
    'Post-stroke cognitive improvement'
  ],
  research_areas = ARRAY['cognitive','immune','longevity'],
  compound_class = 'Synthetic heptapeptide analog of ACTH 4-7 with Pro-Gly-Pro extension; neuroprotective and nootropic',
  molecular_target = 'Melanocortin receptors (MC2R/MC4R); BDNF/NGF upregulation; serotonin/dopamine axis; enkephalinase inhibition'
WHERE slug = 'semax';

-- ==========================================================================
-- 43. SERMORELIN
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'GRF 1-29','Sermorelin Acetate','Geref','Gerel','GRF(1-29)-NH2',
    'Growth hormone releasing factor 1-29','GHRH 1-29','Natural GHRH analog',
    'Sermorelin diagnostic','Sermorelin anti-aging','Sermorelin GHRH peptide',
    'Growth releasing factor','GH stimulation peptide','GHRH 1-29 amide'
  ],
  studied_for = ARRAY[
    'Pituitary GH-reserve diagnostic','Pediatric GH deficiency (historical)',
    'Adult GH-axis / anti-aging research','GH secretagogue research',
    'IGF-1 elevation','Body composition / lean mass','Fat loss via GH axis',
    'Bone density support','Sleep quality via GH','Recovery and repair',
    'GH deficiency models','Metabolic rate improvement',
    'Collagen synthesis via GH','Anti-aging longevity research',
    'GH replacement alternative'
  ],
  research_areas = ARRAY['performance','longevity','metabolic','bone_joint'],
  compound_class = 'Synthetic 29-amino acid fragment of endogenous GHRH (GHRH 1-29-NH2)',
  molecular_target = 'GHRH receptor (GHRHR) on anterior pituitary somatotrophs; stimulates endogenous GH gene expression and release'
WHERE slug = 'sermorelin';

-- ==========================================================================
-- 44. SNAP-8
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Acetyl Octapeptide-3','SNAP 8','Acetyl Glu-Glu-Met-Gln-Arg-Arg-Ala-Asp-NH2',
    'Argireline analog 8-peptide','SNAP-8 octapeptide','Acetyl octapeptide',
    'Expression line peptide','Anti-wrinkle octapeptide','Botox-like peptide topical',
    'Syn-Ake competitor peptide','Snap8 cosmetic peptide'
  ],
  studied_for = ARRAY[
    'Topical anti-wrinkle / expression lines','SNAP-25 mimicry to reduce muscle contraction',
    'Forehead wrinkle reduction','Crow''s feet reduction','Glabellar line reduction',
    'Botulinum toxin analog topical','Expression line depth reduction',
    'SNARE complex disruption topical','Acetylcholine vesicle release inhibition',
    'Facial anti-aging cosmetic research','Neuromuscular junction modulation topical',
    'Dynamic wrinkle prevention'
  ],
  research_areas = ARRAY['cosmetic'],
  compound_class = 'Synthetic acetylated octapeptide; SNAP-25 mimetic for topical anti-wrinkle use',
  molecular_target = 'SNAP-25 (synaptosomal-associated protein 25); competes for SNARE complex assembly; reduces acetylcholine vesicle fusion at neuromuscular junction'
WHERE slug = 'snap-8';

-- ==========================================================================
-- 45. SS-31 (Elamipretide)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Elamipretide','MTP-131','Bendavia','SS-31 peptide','Szeto-Schiller 31',
    'D-Arg-dimethylTyr-Lys-Phe-NH2','Cardiolipin-targeting peptide',
    'Mitochondria-targeted peptide','Mitochondrial protective peptide',
    'Inner mitochondrial membrane peptide','Cardiac mitochondria peptide',
    'Bendavia heart failure','SS31 Barth syndrome'
  ],
  studied_for = ARRAY[
    'Primary mitochondrial disease','Barth syndrome (cardiolipin deficiency)',
    'Heart failure / ischemia-reperfusion injury','Dry AMD (age-related macular degeneration)',
    'Mitochondrial aging','Cardiac energetics','Skeletal muscle mitochondria',
    'Kidney ischemia-reperfusion models','ROS reduction at mitochondria',
    'Cardiolipin stabilization','Respiratory chain Complex I-V efficiency',
    'ATP production enhancement','Frailty / aging mitochondria',
    'Chronic kidney disease models','Neurodegenerative disease mitochondria',
    'Exercise intolerance research'
  ],
  research_areas = ARRAY['longevity','mitochondrial','immune'],
  compound_class = 'Mitochondria-targeted tetrapeptide (D-Arg-dimethylTyr-Lys-Phe-NH2); cardiolipin-targeting',
  molecular_target = 'Cardiolipin on inner mitochondrial membrane; scavenges mitochondrial ROS; stabilizes cristae architecture; restores respiratory chain efficiency'
WHERE slug = 'ss-31';

-- ==========================================================================
-- 46. SURVODUTIDE
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'BI 456906','BI-456906','Survodutide peptide','GLP-1 glucagon dual agonist BI 456906',
    'Boehringer dual agonist','GCGR GLP-1R dual agonist','GLP-1 glucagon obesity drug',
    'Survodutide BI456906','Dual incretin glucagon agonist'
  ],
  studied_for = ARRAY[
    'Obesity / overweight','Type 2 diabetes','MASH / metabolic liver disease',
    'Non-alcoholic steatohepatitis (NASH)','Liver fat reduction',
    'Dual GLP-1 glucagon therapy','HbA1c lowering','Body weight reduction',
    'Cardiovascular risk reduction','Insulin resistance',
    'Metabolic syndrome','Hepatic steatosis','Lipid metabolism'
  ],
  research_areas = ARRAY['metabolic','weight_management'],
  compound_class = 'Synthetic dual agonist: GLP-1 receptor + glucagon receptor',
  molecular_target = 'GLP-1R (satiety, insulin secretion) + GCGR (glucagon receptor: energy expenditure, hepatic lipid metabolism); dual incretin-glucagon signaling'
WHERE slug = 'survodutide';

-- ==========================================================================
-- 47. TB-500 / THYMOSIN BETA-4
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'TB500','TB-500','Thymosin Beta-4','Tbeta4','Thymosin B4 Acetate',
    'Thymosin β-4','TB-4','Tβ4','Thymosin Beta 4','T-beta4',
    'Actin-sequestering peptide','Wound healing thymosin','Cardiac repair thymosin',
    'LKKTETQ peptide motif','Thymosin beta4 synthetic','TB500 injection'
  ],
  studied_for = ARRAY[
    'Dermal / corneal wound healing','Cardiac repair models','Tendon / ligament / muscle injury',
    'Hair growth stimulation','Corneal healing / dry eye models','Blood vessel formation',
    'Angiogenesis','Bone repair','Anti-inflammatory','Nerve repair models',
    'Sports injury recovery','Athletic recovery','Post-surgical healing',
    'Scar tissue reduction','Joint repair','Muscle tear recovery',
    'GI healing','Immune modulation','Stem cell migration'
  ],
  research_areas = ARRAY['healing','tissue_repair','pain_inflammation','bone_joint','cosmetic'],
  compound_class = 'Endogenous 43-amino acid thymic peptide; G-actin sequestrant and tissue-protection factor',
  molecular_target = 'G-actin sequestration (Wiskott-Aldrich Syndrome protein WH2 domain); VEGF upregulation; integrin-linked kinase (ILK); thymosin beta-4 receptor (Tβ4R)'
WHERE slug = 'tb-500';

-- ==========================================================================
-- 48. TESAMORELIN
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Egrifta','Egrifta SV','TH9507','Tesamorelin acetate','Trans-3-hexenoic acid GHRH',
    'Modified GHRH analog Egrifta','HIV lipodystrophy treatment peptide',
    'GHRH analog tesamorelin','Liver fat peptide treatment','Cognitive GHRH analog'
  ],
  studied_for = ARRAY[
    'HIV-associated lipodystrophy (FDA approved)','Hepatic fat / NAFLD research',
    'Cognition research in aging/HIV','GH deficiency','Body composition improvement',
    'Visceral adipose reduction','Liver fat reduction','GH axis stimulation',
    'IGF-1 elevation','Cardiovascular lipid profile improvement',
    'Cognitive decline in aging HIV+ population','Anti-aging via GH axis',
    'Non-alcoholic fatty liver disease','Lean mass support'
  ],
  research_areas = ARRAY['performance','metabolic','weight_management','bone_joint','cognitive'],
  compound_class = 'Synthetic GHRH analog with trans-3-hexenoic acid modification at N-terminus; FDA-approved for HIV lipodystrophy',
  molecular_target = 'GHRH receptor (GHRHR) on pituitary somatotrophs; GH/IGF-1 axis stimulation; preferential visceral fat metabolism'
WHERE slug = 'tesamorelin';

-- ==========================================================================
-- 49. THYMALIN
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Thymus polypeptide bioregulator','Thymalin peptide','Thymus bioregulator',
    'Thymus extract bioregulator','Khavinson thymus peptide','Thymulin analog',
    'Immune restoration bioregulator','Thymic polypeptide thymalin',
    'Calf thymus extract peptide','Immunomodulatory thymalin'
  ],
  studied_for = ARRAY[
    'Immunosenescence reversal','Immune system restoration in aging',
    'Infection resistance enhancement','T-cell function restoration',
    'Longevity via immune optimization','Age-related immune decline',
    'Cancer immune surveillance research','HIV immune support models',
    'Chronic infection models','Thymus involution reversal',
    'Autoimmune modulation research','Antioxidant protection',
    'Melatonin-thymalin longevity combination'
  ],
  research_areas = ARRAY['longevity','immune'],
  compound_class = 'Polypeptide thymic bioregulator derived from calf thymus tissue',
  molecular_target = 'T-lymphocyte differentiation and maturation; thymic hormones (thymosin, thymopoietin analog); IL-2 / IFN-gamma restoration'
WHERE slug = 'thymalin';

-- ==========================================================================
-- 50. THYMOSIN ALPHA-1
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Thymalfasin','Zadaxin','Talpha1','Tα1','Thymosin alpha 1',
    'Thymosin α1','Thymalfasine','Hepatitis thymosin','Immune adjuvant thymosin',
    'TA1','Zadaxin thymosin','Thymosin alpha-1 acetate',
    'Prothymosin fragment','Hepatitis B immune peptide'
  ],
  studied_for = ARRAY[
    'Chronic hepatitis B treatment','Chronic hepatitis C treatment',
    'Cancer immune adjunct therapy','Vaccine adjuvant','Sepsis / severe infection',
    'COVID-19 immune support research','Immunodeficiency models',
    'HIV / AIDS immune support','Antifungal immune support',
    'Malignant melanoma adjuvant','Lung cancer immune research',
    'T-cell / NK cell activation','Dendritic cell maturation',
    'Toll-like receptor signaling','Autoimmune modulation',
    'Gut mucosal immunity','Chemotherapy immune protection'
  ],
  research_areas = ARRAY['immune','longevity','gut_health','pain_inflammation'],
  compound_class = '28-amino acid peptide; N-terminal fragment of prothymosin alpha; biological response modifier',
  molecular_target = 'TLR2/TLR9 signaling; dendritic cell maturation; T-helper (Th1) polarization; NK cell cytotoxicity; NF-kB immunomodulation'
WHERE slug = 'thymosin-alpha-1';

-- ==========================================================================
-- 51. TIRZEPATIDE
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Mounjaro','Zepbound','LY3298176','Tirzepatide peptide','GIP GLP-1 dual agonist',
    'Eli Lilly dual agonist','Twin incretin','Twincretin','GLP-1 GIP tirzepatide',
    'Mounjaro injection','Zepbound injection','Tirzepatide LY3298176',
    'Dual incretin obesity drug','Tirzapatide','Tirzepetide'
  ],
  studied_for = ARRAY[
    'Type 2 diabetes management','Chronic weight management / obesity',
    'Obstructive sleep apnea in obesity (FDA approved 2024)',
    'Non-alcoholic fatty liver disease (NAFLD/MASH)','Cardiovascular risk reduction',
    'HbA1c lowering','Body weight reduction superior to semaglutide',
    'Insulin resistance','Metabolic syndrome','Polycystic ovary syndrome',
    'Kidney disease in diabetes','Heart failure with obesity',
    'Appetite suppression dual pathway','Lean mass preservation'
  ],
  research_areas = ARRAY['metabolic','weight_management'],
  compound_class = 'Dual GIP/GLP-1 receptor co-agonist (twincretin); synthetic 39-residue peptide with C18 fatty diacid for albumin binding',
  molecular_target = 'GIPR (GIP receptor) + GLP-1R (GLP-1 receptor); dual incretin axis activation; pancreatic insulin secretion and hypothalamic appetite suppression'
WHERE slug = 'tirzepatide';

-- ==========================================================================
-- 52. VIP (Vasoactive Intestinal Peptide)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Vasoactive Intestinal Peptide','Aviptadil','RLF-100','VIP peptide','VPAC agonist',
    'Vasoactive intestinal polypeptide','VIP neuropeptide','Aviptadil COVID',
    'VIP ARDS treatment','Intestinal neuropeptide VIP','Vasorelaxant peptide',
    'Pituitary adenylate cyclase peptide family','PACAP-related peptide'
  ],
  studied_for = ARRAY[
    'ARDS / acute respiratory failure research','Pulmonary hypertension',
    'Sarcoidosis treatment research','Erectile dysfunction (intracavernosal)',
    'COVID-19 respiratory complication research','GI motility modulation',
    'Intestinal inflammation / IBD','Neurotransmission modulation',
    'Vasodilation / blood pressure','Immune modulation','Lung protection',
    'Asthma research','Pancreatic secretion','Circadian rhythm modulation',
    'Anti-inflammatory cytokine modulation','Neuroprotection'
  ],
  research_areas = ARRAY['immune','gut_health','sexual_health','cognitive'],
  compound_class = '28-amino acid neuropeptide and hormone; member of secretin/glucagon superfamily',
  molecular_target = 'VPAC1 and VPAC2 receptors (VIP/PACAP receptors); cAMP/PKA signaling; vasodilation, bronchodilation, immune modulation, GI motility'
WHERE slug = 'vip';

-- ==========================================================================
-- 53. VITAMIN B12
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Methylcobalamin','Cyanocobalamin','Cobalamin','Hydroxocobalamin','Adenosylcobalamin',
    'B12','Vitamin B-12','Mecobalamin','MeCbl','CNCbl','Cobamamide',
    'Methylcobalamin injection','B12 shot','B12 injection','Cobalamin B12',
    'Neurological vitamin B12','Energy vitamin B12'
  ],
  studied_for = ARRAY[
    'Vitamin B12 deficiency / pernicious anemia','Megaloblastic anemia',
    'Peripheral neuropathy support','Neurological disease (subacute combined degeneration)',
    'Cognitive decline / dementia prevention','Homocysteine reduction',
    'Cardiovascular risk via homocysteine','Fatigue and energy restoration',
    'Methylation pathway support','Immune function support',
    'Pregnancy (neural tube prevention)','Vegan/vegetarian supplementation',
    'Methyl donor coenzyme','DNA synthesis support','Myelin sheath maintenance'
  ],
  research_areas = ARRAY['metabolic','immune','cognitive','longevity'],
  compound_class = 'Water-soluble vitamin B12 (cobalamin); essential coenzyme for methylation and myelin synthesis',
  molecular_target = 'Methionine synthase (methylcobalamin form); methylmalonyl-CoA mutase (adenosylcobalamin form); DNA synthesis; myelin basic protein maintenance'
WHERE slug = 'b12';

-- ==========================================================================
-- 54. 5-AMINO-1MQ
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    '5-Amino-1-methylquinolinium','5A1MQ','5-amino-1-methylquinolinium salt',
    'NNMT inhibitor 5-amino-1mq','Nicotinamide N-methyltransferase inhibitor',
    '5-amino 1MQ','Small molecule fat loss','NNMT blocker',
    '5AMQ','Metabolic NNMT inhibitor','5-amino-1MQ salt',
    '1-methyl-5-aminoquinolinium'
  ],
  studied_for = ARRAY[
    'Obesity / metabolic syndrome','Fat-loss / energy-expenditure research',
    'NAD+ metabolism enhancement','NNMT inhibition','Adipogenesis inhibition',
    'Adipocyte differentiation blocking','Lean mass preservation',
    'Insulin sensitivity improvement','Lipid metabolism','Diet-induced obesity models',
    'Weight management without appetite suppression',
    'SAM (S-adenosyl methionine) pool preservation','Epigenetic metabolic regulation',
    'Mitochondrial efficiency','Exercise performance'
  ],
  research_areas = ARRAY['metabolic','weight_management','mitochondrial','performance'],
  compound_class = 'Small-molecule NNMT inhibitor (quinolinium salt); not a peptide',
  molecular_target = 'Nicotinamide N-methyltransferase (NNMT) inhibition; preserves SAM and NAD+ pools; reduces adipogenesis; enhances energy expenditure'
WHERE slug = '5-amino-1mq';

-- ==========================================================================
-- 55. AHK-Cu (Copper Tripeptide-3)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Copper Tripeptide-3','AHK-CU','AHK copper','Ala-His-Lys copper complex',
    'AHK Cu','Copper peptide AHK','Follicle copper peptide',
    'Hair growth copper tripeptide','Dermal copper AHK','AHK-Cu tripeptide',
    'GHK-Cu analog hair','Alanine-Histidine-Lysine copper'
  ],
  studied_for = ARRAY[
    'Hair follicle growth / restoration','Alopecia models','Androgenetic alopecia research',
    'Dermal regeneration','Skin anti-aging','Collagen and elastin synthesis',
    'Scalp health','Hair density improvement','Follicle miniaturization reversal',
    'Wound healing','Angiogenesis for follicle support',
    'Bone density (copper-mediated collagen)','Skin barrier restoration',
    'Anti-inflammatory scalp research'
  ],
  research_areas = ARRAY['cosmetic','bone_joint','healing','tissue_repair'],
  compound_class = 'Copper-binding tripeptide (Ala-His-Lys + Cu2+); GHK-Cu analog with hair-follicle specificity',
  molecular_target = 'Copper delivery to follicle; FGF-7 (KGF) and VEGF upregulation; collagen synthesis; SOD-like antioxidant activity'
WHERE slug = 'ahk-cu';

-- ==========================================================================
-- 56. AICAR
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Acadesine','AICA-riboside','5-aminoimidazole-4-carboxamide ribonucleotide',
    'AICAR nucleoside','ZMP precursor','Acadesine AICAR',
    'AMPK activator AICAR','Exercise mimetic AICAR','Metabolic research AICAR',
    'AICA ribonucleoside','Purine nucleoside analog AICAR'
  ],
  studied_for = ARRAY[
    'AMPK / metabolic-stress research','Insulin-resistance models','Endurance research',
    'Exercise mimetic','Fat oxidation via AMPK','Glucose uptake enhancement',
    'Cardiac protection / ischemia','Obesity models','Metabolic syndrome research',
    'WADA prohibited performance substance research','Mitochondrial biogenesis',
    'Type 2 diabetes models','Cancer metabolism research','AMPK pathway signaling',
    'Anti-inflammatory via AMPK'
  ],
  research_areas = ARRAY['metabolic','performance','mitochondrial'],
  compound_class = 'Purine nucleoside analog; cell-permeable AMPK activator (converted intracellularly to ZMP)',
  molecular_target = 'AMP-activated protein kinase (AMPK) activation via ZMP (AMP mimetic); PGC-1alpha upregulation; GLUT4 translocation; mitochondrial biogenesis'
WHERE slug = 'aicar';

-- ==========================================================================
-- 57. ARA-290 (Cibinetide)
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'Cibinetide','ARA290','ARA-290 peptide','Non-hematopoietic EPO peptide',
    'Tissue-protective peptide EPO','Innate repair receptor agonist',
    'EPO-derived peptide','Cibinetide ARA-290','Small-fiber neuropathy peptide',
    'Sarcoidosis neuropathy peptide','EPO analog non-hematopoietic'
  ],
  studied_for = ARRAY[
    'Small-fiber neuropathy (sarcoidosis, diabetes)','Neuropathic pain research',
    'Tissue-injury repair','Diabetic neuropathy models','Sarcoidosis-related neuropathy',
    'Corneal nerve fiber regeneration','Immune modulation','Anti-inflammatory',
    'Sepsis models','Cardiac ischemia protection','Renal protection',
    'Obesity metabolic improvement','Beta-cell protection in diabetes',
    'Wound healing acceleration'
  ],
  research_areas = ARRAY['healing','immune','pain_inflammation','cognitive'],
  compound_class = 'Non-hematopoietic EPO-derived 11-amino acid cyclic peptide; innate repair receptor agonist',
  molecular_target = 'Innate repair receptor (IRR = EPO-R + CD131 beta-common heterodimer); tissue-protective signaling without erythropoiesis; anti-apoptotic and anti-inflammatory'
WHERE slug = 'ara-290';

-- ==========================================================================
-- 58. CAGRILINTIDE
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'AM833','Cagrilintide AM833','Long-acting amylin analog','Amylin receptor agonist',
    'Calcitonin receptor agonist obesity','Amylin obesity peptide',
    'Pramlintide analog long-acting','Amylin analog cagrilintide',
    'Novo Nordisk amylin','Cagrilintide weekly injection'
  ],
  studied_for = ARRAY[
    'Obesity / overweight','Type 2 diabetes','Combination with semaglutide (CagriSema)',
    'Amylin receptor agonism for satiety','Caloric intake reduction',
    'Body weight reduction','Glucagon suppression','Gastric emptying delay',
    'Amylin-mediated satiety signaling','Cardiometabolic risk reduction',
    'Insulin sensitivity improvement','Metabolic syndrome'
  ],
  research_areas = ARRAY['metabolic','weight_management','hormonal'],
  compound_class = 'Long-acting synthetic amylin analog (fatty acid-conjugated for once-weekly dosing)',
  molecular_target = 'Amylin receptor (AMY1-3, CTR + RAMP1/2/3 complexes) and calcitonin receptor (CTR); hypothalamic satiety signaling; gastric motility modulation'
WHERE slug = 'cagrilintide';

-- ==========================================================================
-- 59. CEREBROLYSIN
-- ==========================================================================
UPDATE compounds SET
  aliases = ARRAY[
    'FPF-1070','Cerebrolysin injection','Porcine brain peptide hydrolysate',
    'Brain peptide mixture','Neurotrophic peptide mixture','EVER Neuro Pharma cerebrolysin',
    'Cerebrolysin infusion','Cerebrolysin neuropeptides','Neurotrophic factor mimetic blend',
    'BDNF NGF mimetic cerebrolysin','Cerebrolysin stroke treatment'
  ],
  studied_for = ARRAY[
    'Acute ischemic stroke recovery','Traumatic brain injury (TBI)','Vascular dementia',
    'Alzheimer''s-type dementia','Cognitive impairment recovery','Neuroprotection',
    'Neuroregeneration','BDNF and NGF pathway stimulation','Post-stroke rehabilitation',
    'Parkinson''s disease research','ADHD research','Memory enhancement',
    'Anti-apoptotic neuronal protection','Neuroplasticity promotion',
    'Spine injury models','Cerebral ischemia protection',
    'Age-related cognitive decline'
  ],
  research_areas = ARRAY['cognitive','healing','longevity'],
  compound_class = 'Porcine brain-derived standardized peptide hydrolysate (<10 kDa peptides); neurotrophic factor mimetic',
  molecular_target = 'BDNF/TrkB pathway; NGF/TrkA pathway; anti-apoptotic (Bcl-2 upregulation); antioxidant; glutamate excitotoxicity protection'
WHERE slug = 'cerebrolysin';

-- ============================================================================
-- REFRESH MATERIALIZED VIEW for immediate search effect
-- ============================================================================
SELECT refresh_compound_search();

COMMIT;
