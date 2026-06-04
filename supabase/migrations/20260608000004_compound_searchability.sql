-- ============================================================
-- Migration: Maximize compound searchability & discoverability
-- Every compound gets exhaustive aliases, studied_for, and research_areas
-- so researchers can find products via any possible search term.
-- ============================================================

UPDATE compounds SET
  aliases = ARRAY['AOD 9604','hGH Fragment 177-191','Tyr-hGH 177-191','Growth hormone fragment','Fat-loss peptide','Anti-obesity peptide','GH lipolytic fragment','hGH C-terminal','AOD-9604'],
  studied_for = ARRAY['Obesity / fat-metabolism research','Lipolysis / fat burning','Visceral fat reduction','Adipose tissue breakdown','Fat loss without GH side effects','Metabolic syndrome research','Body composition improvement','Weight management','Belly fat reduction','Fat oxidation'],
  research_areas = ARRAY['metabolic','weight_management','performance']
WHERE slug = 'aod9604';

UPDATE compounds SET
  aliases = ARRAY['Body Protection Compound','BPC157','BPC 157','Pentadecapeptide','Stable gastric pentadecapeptide','PL 14736','PnP','Body Protecting Compound','Wolverine peptide'],
  studied_for = ARRAY['GI mucosal healing','Gut lining repair','Leaky gut','Ulcer healing','Tendon repair','Ligament repair','Muscle repair','Nerve regeneration','Anti-inflammatory','Wound healing','Joint pain','Bone healing','Brain injury recovery','Systemic healing','Cytoprotection','Angiogenesis','NSAID-induced gut damage','IBD / inflammatory bowel disease','Crohn''s disease research','Colitis','GERD / acid reflux','Sports injury recovery','Cartilage repair','Chronic pain'],
  research_areas = ARRAY['healing','tissue_repair','gut_health','pain_inflammation','bone_joint','cognitive']
WHERE slug = 'bpc-157';

UPDATE compounds SET
  aliases = ARRAY['BPC TB stack','BPC+TB','BPC-157 TB-500 blend','Repair stack','Ultimate healing stack','Body protection thymosin stack','BPC TB combo'],
  studied_for = ARRAY['Soft-tissue repair','Tendon healing','Ligament healing','Muscle recovery','Joint repair','Wound healing','Nerve regeneration','Systemic tissue healing','Sports injury recovery','Post-surgery recovery','Anti-inflammatory support','GI healing','Comprehensive tissue repair'],
  research_areas = ARRAY['healing','tissue_repair','pain_inflammation','gut_health','bone_joint']
WHERE slug = 'bpc-tb';

UPDATE compounds SET
  aliases = ARRAY['CagriSema','Cagrilintide semaglutide combination','AM833 + NN9535','Amylin GLP-1 combo','Weight loss combination','CagriSema dual therapy'],
  studied_for = ARRAY['Obesity treatment','Severe weight loss','Type 2 diabetes','Metabolic syndrome','Body weight reduction','Appetite suppression','Blood sugar control','Cardiovascular risk reduction','NASH / fatty liver','Combination weight management therapy'],
  research_areas = ARRAY['metabolic','weight_management','hormonal']
WHERE slug = 'cagrisema';

UPDATE compounds SET
  aliases = ARRAY['CJC-1295 DAC','CJC1295 DAC','GHRH analog with DAC','Drug Affinity Complex CJC','Long-acting GHRH','Modified GRF with DAC','CJC 1295 with DAC'],
  studied_for = ARRAY['Growth hormone release','GH pulsatile research','Anti-aging / longevity','Body composition improvement','Muscle growth','Fat loss','IGF-1 elevation','Sleep quality','Recovery','HGH enhancement','GH deficiency research','Tissue repair'],
  research_areas = ARRAY['performance','longevity','metabolic','healing']
WHERE slug = 'cjc-1295-dac';

UPDATE compounds SET
  aliases = ARRAY['CJC-1295 no DAC','CJC1295 no DAC','Mod GRF 1-29','Modified GRF','Modified GRF(1-29)','Sermorelin analog','GHRH 1-29','Short-acting GHRH','CJC no DAC'],
  studied_for = ARRAY['Pulsatile GH stimulation','Growth hormone release','Anti-aging','Sleep quality improvement','Muscle growth','Fat loss','Body composition','IGF-1 elevation','Recovery acceleration','GH secretagogue research','Performance enhancement','Energy levels'],
  research_areas = ARRAY['performance','longevity','metabolic','sleep','healing']
WHERE slug = 'cjc-1295-no-dac';

UPDATE compounds SET
  aliases = ARRAY['CJC IPA stack','CJC Ipamorelin stack','CJC+Ipamorelin','CJC-1295 Ipamorelin blend','GHRH GHRP combo','Dual GH stack','Growth hormone stack','HGH stack'],
  studied_for = ARRAY['Dual-pathway GH stimulation','Growth hormone optimization','Muscle building','Fat loss','Anti-aging','Sleep improvement','Body composition','IGF-1 elevation','Recovery','Energy','Performance enhancement','Lean muscle mass'],
  research_areas = ARRAY['performance','longevity','metabolic','sleep']
WHERE slug = 'cjc-ipamorelin';

UPDATE compounds SET
  aliases = ARRAY['Delta Sleep-Inducing Peptide','DSIP peptide','Sleep peptide','Delta sleep peptide'],
  studied_for = ARRAY['Sleep onset improvement','Insomnia research','Deep sleep enhancement','Stress modulation','Cortisol regulation','Hypothalamic regulation','Circadian rhythm','REM sleep','Sleep quality','Anxiolytic effects','Narcolepsy research','Withdrawal support'],
  research_areas = ARRAY['sleep','cognitive','hormonal']
WHERE slug = 'dsip';

UPDATE compounds SET
  aliases = ARRAY['Epitalon','Epithalamin','Ala-Glu-Asp-Gly','AGAG tetrapeptide','Pineal gland peptide','Epitalon peptide','Epitalone'],
  studied_for = ARRAY['Telomere elongation','Anti-aging / longevity','Lifespan extension','Circadian rhythm regulation','Antioxidant','Cancer research','Immune restoration','Neurodegeneration prevention','Melatonin normalization','Pineal gland function','DNA repair','Cellular aging','Healthspan extension','Sleep regulation'],
  research_areas = ARRAY['longevity','immune','sleep','cognitive','metabolic']
WHERE slug = 'epithalon';

UPDATE compounds SET
  aliases = ARRAY['FST','Follistatin 344','FS-344','Follistatin-344','Myostatin inhibitor','FST344','Follistatin peptide'],
  studied_for = ARRAY['Muscle hypertrophy','Myostatin inhibition','Muscle growth','Strength gains','Female fertility research','Lean muscle mass','Bodybuilding research','Anabolic research','Muscle building','Mass gains','Anti-catabolic','Bone density'],
  research_areas = ARRAY['performance','hormonal','bone_joint']
WHERE slug = 'follistatin';

UPDATE compounds SET
  aliases = ARRAY['FOXO4 D-Retro-Inverso','FOXO4-p53 inhibitor','Senolytic peptide','Anti-senescence peptide','FOXO4 DRI','Senescent cell eliminator'],
  studied_for = ARRAY['Senolytics','Cellular senescence clearance','Anti-aging','Healthspan extension','Chemotherapy-induced senescence','Age-related tissue dysfunction','Hair restoration','Kidney function','Immune rejuvenation','Longevity research','Senescent cell apoptosis','Age reversal'],
  research_areas = ARRAY['longevity','immune','healing','cosmetic']
WHERE slug = 'foxo4-dri';

UPDATE compounds SET
  aliases = ARRAY['Copper peptide','GHK-Copper','Glycyl-L-histidyl-L-lysine copper','GHK Cu','Copper tripeptide','GHK','Glycyl histidyl lysine'],
  studied_for = ARRAY['Wound healing','Skin anti-aging','Hair loss research','Hair regrowth','Antioxidant / anti-inflammatory','Collagen synthesis','Skin elasticity','Wrinkle reduction','Angiogenesis','Nerve regeneration','Lung tissue repair','Anti-inflammatory','Skin brightening','Scar healing','Tissue remodeling','Scalp health'],
  research_areas = ARRAY['cosmetic','healing','tissue_repair','longevity','pain_inflammation']
WHERE slug = 'ghk-cu';

UPDATE compounds SET
  aliases = ARRAY['Pralmorelin','GHRP2','KP-102','Growth Hormone Releasing Peptide 2','GHRP-2 acetate','Ghrelin mimetic'],
  studied_for = ARRAY['GH deficiency diagnosis','GH secretagogue research','Growth hormone stimulation','Muscle growth','Fat loss','Body composition','Appetite stimulation','Anti-aging','IGF-1 elevation','Cardiac protection','Bone density'],
  research_areas = ARRAY['performance','longevity','hormonal','metabolic']
WHERE slug = 'ghrp-2';

UPDATE compounds SET
  aliases = ARRAY['GHRP6','Growth Hormone Releasing Hexapeptide','GHRP 6','Ghrelin analog','His-DTrp-Ala-Trp-DPhe-Lys'],
  studied_for = ARRAY['GH release','Growth hormone stimulation','Appetite stimulation','Muscle growth','GI motility research','IGF-1 elevation','Hunger increase','Bodybuilding','Anti-aging','Cytoprotection','Fat loss'],
  research_areas = ARRAY['performance','longevity','hormonal','gut_health']
WHERE slug = 'ghrp-6';

UPDATE compounds SET
  aliases = ARRAY['TB500+BPC157+GHK-Cu stack','GLOW stack','Skin regeneration stack','Anti-aging peptide blend','Cosmetic peptide stack','Glow peptide combination'],
  studied_for = ARRAY['Skin anti-aging / regeneration','Collagen synthesis','Wound healing','Skin elasticity','Hair growth','Complexion improvement','Tissue repair','Anti-inflammatory','Glow skin','Youthful skin research'],
  research_areas = ARRAY['cosmetic','healing','tissue_repair','longevity']
WHERE slug = 'glow';

UPDATE compounds SET
  aliases = ARRAY['GSH','L-Glutathione','Reduced glutathione','Gamma-glutamylcysteinylglycine','Master antioxidant'],
  studied_for = ARRAY['Antioxidant','Detoxification','Liver protection','Skin brightening','Immune support','Oxidative stress reduction','Heavy metal chelation','Cancer adjunct research','Neuroprotection','Anti-aging','Inflammation reduction','Chronic disease prevention','Whitening / brightening'],
  research_areas = ARRAY['immune','longevity','metabolic','cosmetic','cognitive']
WHERE slug = 'glutathione';

UPDATE compounds SET
  aliases = ARRAY['Human Chorionic Gonadotropin','hCG','Choriogonadotropin alfa','Pregnyl','Novarel','Ovidrel','Profasi'],
  studied_for = ARRAY['Male hypogonadism','Fertility treatment','TRT support','Testosterone production','Ovulation induction','Spermatogenesis','Testicular atrophy prevention','Cryptorchidism','IVF support','LH mimetic','Testosterone stimulation','Hormonal support'],
  research_areas = ARRAY['hormonal','sexual_health','immune']
WHERE slug = 'hcg';

UPDATE compounds SET
  aliases = ARRAY['Examorelin','EP-23905','MF-6003','Hexarelin acetate','GHRP analogue'],
  studied_for = ARRAY['GH secretagogue research','Growth hormone stimulation','Cardiac protection','Cytoprotection','Heart failure research','Muscle growth','Anti-aging','IGF-1 elevation','Ventricular function','Body composition'],
  research_areas = ARRAY['performance','longevity','hormonal']
WHERE slug = 'hexarelin';

UPDATE compounds SET
  aliases = ARRAY['HGH Frag','Frag 176-191','AOD Fragment','HGH Fragment','hGH 176-191','Fragment 176-191','Growth hormone lipolytic fragment'],
  studied_for = ARRAY['Lipolysis / fat loss','Fat burning','Adipose reduction','Weight loss','Visceral fat','Body fat reduction','Obesity research','Metabolic rate increase','Anti-obesity','Fat mass reduction'],
  research_areas = ARRAY['metabolic','weight_management','performance']
WHERE slug = 'hgh-fragment-176-191';

UPDATE compounds SET
  aliases = ARRAY['Human Menopausal Gonadotropin','Menotropin','Menopur','Repronex','FSH+LH','hMG'],
  studied_for = ARRAY['IVF / ART','Ovulation induction','Spermatogenesis','Female fertility','Male fertility','Gonadotropin therapy','Polycystic ovary syndrome','Hypogonadotropic hypogonadism','Egg stimulation','ART protocol'],
  research_areas = ARRAY['hormonal','sexual_health']
WHERE slug = 'hmg';

UPDATE compounds SET
  aliases = ARRAY['Long-Arg3 IGF-I','IGF-1 LR3','Insulin-like Growth Factor 1 LR3','Long R3 IGF-1','LR3-IGF1','Mechano Growth Factor'],
  studied_for = ARRAY['Muscle growth','Anabolic research','GH axis signaling','Lean muscle mass','Protein synthesis','Hypertrophy','Fat loss','Recovery','Athletic performance','Cell proliferation','Anti-catabolic','Bodybuilding'],
  research_areas = ARRAY['performance','metabolic','longevity']
WHERE slug = 'igf-1-lr3';

UPDATE compounds SET
  aliases = ARRAY['NNC 26-0161','Ipamorelin acetate','GHRP 5','GH secretagogue','Growth releasing peptide 5'],
  studied_for = ARRAY['GH secretagogue research','Growth hormone release','Anti-aging / longevity','Body composition','Muscle growth','Fat loss','Sleep quality','Bone density','Recovery','Energy','IGF-1 elevation','Performance enhancement'],
  research_areas = ARRAY['performance','longevity','metabolic','sleep','bone_joint']
WHERE slug = 'ipamorelin';

UPDATE compounds SET
  aliases = ARRAY['Kisspeptin','Metastin','KP-10','Kisspeptin-10 acetate','KISS1 derived peptide','Kisspeptin 10'],
  studied_for = ARRAY['Reproductive axis research','LH/FSH stimulation','Fertility research','Testosterone stimulation','HPG axis activation','Puberty research','Ovulation induction','Hypogonadism','Sexual function','Hormonal optimization'],
  research_areas = ARRAY['hormonal','sexual_health']
WHERE slug = 'kisspeptin-10';

UPDATE compounds SET
  aliases = ARRAY['KLOW stack','TB10+BPC10+GHK50+KPV10','Comprehensive healing stack','KLOW blend','Healing and gut stack','Full repair stack'],
  studied_for = ARRAY['Comprehensive tissue healing','Gut health and repair','Joint and tendon recovery','Anti-inflammatory','Skin regeneration','Immune modulation','Systemic repair','Wound healing','Sports recovery','Leaky gut repair','Full body recovery stack'],
  research_areas = ARRAY['healing','tissue_repair','gut_health','pain_inflammation','immune','cosmetic']
WHERE slug = 'klow';

UPDATE compounds SET
  aliases = ARRAY['Lys-Pro-Val','alpha-MSH tripeptide','MSH fragment','KPV tripeptide','Alpha-MSH C-terminal','Melanocyte-stimulating hormone fragment'],
  studied_for = ARRAY['GI inflammation / IBD','Crohn''s disease','Ulcerative colitis','Skin inflammation','Wound healing','Immune modulation','Gut mucosal protection','Anti-inflammatory','Autoimmune research','Melanocortin anti-inflammation','Psoriasis research','Dermatitis'],
  research_areas = ARRAY['gut_health','immune','healing','pain_inflammation','cosmetic']
WHERE slug = 'kpv';

UPDATE compounds SET
  aliases = ARRAY['Carnitine','Levocarnitine','L-Carnitine tartrate','ALCAR','Acetyl-L-Carnitine','Acetylcarnitine','ALC'],
  studied_for = ARRAY['Fat oxidation','Energy metabolism','Exercise performance','Cognitive support','Cardiovascular health','Insulin sensitivity','Weight management','Fatigue reduction','Muscle recovery','Brain health','Neuroprotection','Male fertility','Athletic endurance'],
  research_areas = ARRAY['metabolic','performance','cognitive','weight_management','hormonal']
WHERE slug = 'l-carnitine';

UPDATE compounds SET
  aliases = ARRAY['Riboflavin/Bromelain lipolytic blend','Fat dissolving injection','Aesthetic lipolytic','Lipolytic cocktail','Deoxycholic acid blend','Fat melting injection','Spot fat reduction injection'],
  studied_for = ARRAY['Localized fat reduction (aesthetic)','Double chin treatment','Submental fat','Spot reduction','Body contouring','Aesthetic lipolysis','Lipodissolve','Local adipolysis'],
  research_areas = ARRAY['metabolic','cosmetic','weight_management']
WHERE slug = 'lemon-bottle';

UPDATE compounds SET
  aliases = ARRAY['MIC blend','Lipotropic injection','MIC injection','Methionine Inositol Choline','MIC-B12 injection','Lipotropic cocktail','MIC shot','Fat-burning injection'],
  studied_for = ARRAY['Weight-management adjunct','Lipid metabolism support','Liver detoxification','Fat mobilization','Energy metabolism','B-vitamin supplementation','Metabolic support','Fat oxidation','Liver health'],
  research_areas = ARRAY['metabolic','weight_management']
WHERE slug = 'lipo-c';

UPDATE compounds SET
  aliases = ARRAY['Cathelicidin','hCAP-18 fragment','CAP-18','hCAP18','Cathelicidin LL-37','CRAMP','LL37 peptide','Human cathelicidin'],
  studied_for = ARRAY['Antimicrobial / antibiofilm','Wound healing','Innate immunity','Autoimmune disease research','Bacterial infection','Viral infection','Skin infection','Wound infection','Inflammatory bowel disease','Sepsis prevention','Immune modulation','Angiogenesis','Anti-cancer research','Lupus research','Psoriasis'],
  research_areas = ARRAY['immune','healing','gut_health','pain_inflammation','cosmetic']
WHERE slug = 'll-37';

UPDATE compounds SET
  aliases = ARRAY['N-acetyl-5-methoxytryptamine','Melatonin hormone','Pineal hormone','Sleep hormone','MLT','Circadin'],
  studied_for = ARRAY['Sleep onset / insomnia','Circadian / jet-lag disorders','Antioxidant / neuroprotection','Jet lag','Shift work sleep disorder','REM sleep','Deep sleep','Anti-aging / longevity','Cancer adjunct research','Mitochondrial protection','Immune modulation','Mood regulation','Cortisol reduction'],
  research_areas = ARRAY['sleep','longevity','immune','cognitive','hormonal']
WHERE slug = 'melatonin';

UPDATE compounds SET
  aliases = ARRAY['Mitochondrial ORF of 12S rRNA type-c','MOTS-c peptide','Mitochondrial peptide','Exercise mimetic peptide','Mitohormetic peptide'],
  studied_for = ARRAY['Metabolic homeostasis','Insulin resistance / obesity','Exercise-mimetic research','AMPK activation','Longevity','Anti-aging','Energy metabolism','Fat loss','Glucose utilization','Mitochondrial function','Metabolic syndrome','Diabetes research','Obesity','Healthspan extension'],
  research_areas = ARRAY['metabolic','mitochondrial','performance','weight_management','longevity']
WHERE slug = 'mots-c';

UPDATE compounds SET
  aliases = ARRAY['Afamelanotide','Scenesse','NDP-MSH','[Nle4,D-Phe7]-alpha-MSH','Melanotan 1','MT-1','Afamelanotide acetate'],
  studied_for = ARRAY['Erythropoietic protoporphyria (approved treatment)','Photodermatoses','Tanning / skin pigmentation','Light sensitivity','Solar urticaria','Polymorphous light eruption','Vitiligo research','Skin protection'],
  research_areas = ARRAY['cosmetic','immune','hormonal']
WHERE slug = 'mt-1';

UPDATE compounds SET
  aliases = ARRAY['Nicotinamide adenine dinucleotide','NAD','NAD+ IV','NADH','NAD coenzyme','Nicotinamide','Anti-aging coenzyme','Cellular energy coenzyme','NAD therapy'],
  studied_for = ARRAY['Aging / cellular senescence','Mitochondrial / metabolic dysfunction','Neurodegeneration models','DNA repair','Sirtuin activation','Energy metabolism','Cognitive function','Addiction recovery','Chronic fatigue','Inflammation reduction','Brain health','Longevity','Parkinson''s research','Alzheimer''s research','Metabolic syndrome','Exercise performance','Anti-aging'],
  research_areas = ARRAY['longevity','metabolic','mitochondrial','cognitive','immune']
WHERE slug = 'nad-plus';

UPDATE compounds SET
  aliases = ARRAY['Pitocin','Syntocinon','Oxytocin Acetate','Love hormone','Bonding hormone','Trust hormone','OT','Oxt'],
  studied_for = ARRAY['Labor induction / postpartum hemorrhage','Milk let-down','Social-cognition research','Trust and bonding','Anxiety reduction','Autism spectrum research','Social behavior','Sexual function','Orgasm intensity','Pair bonding','Stress reduction','Depression research','Maternal behavior','PTSD research'],
  research_areas = ARRAY['sexual_health','cognitive','immune','hormonal']
WHERE slug = 'oxytocin';

UPDATE compounds SET
  aliases = ARRAY['EDR peptide','Glu-Asp-Arg','EDR tripeptide','Pineal bioregulator','Brain bioregulator tripeptide'],
  studied_for = ARRAY['Neuroprotection','Neuronal aging','Cognition research','Memory enhancement','Anti-aging','Brain health','Oxidative stress reduction','Sleep regulation','Circadian rhythm','Alzheimer''s prevention research','Retinal protection'],
  research_areas = ARRAY['longevity','cognitive','sleep']
WHERE slug = 'pinealon';

UPDATE compounds SET
  aliases = ARRAY['Bremelanotide','Vyleesi','PT141','PT 141','Melanocortin agonist','Sexual peptide','Libido peptide'],
  studied_for = ARRAY['Hypoactive sexual desire disorder (approved, premenopausal women)','Erectile dysfunction research','Female sexual dysfunction','Libido enhancement','Sexual arousal','Male sexual performance','Low sex drive','Sexual health','Anorgasmia research'],
  research_areas = ARRAY['sexual_health','hormonal','cognitive']
WHERE slug = 'pt-141';

UPDATE compounds SET
  aliases = ARRAY['LY-3437943','LY3437943','Triple-G','Triple agonist','GLP-1 GIP glucagon agonist','Retatrutide peptide'],
  studied_for = ARRAY['Obesity / overweight','Type 2 diabetes','Liver fat (MASLD)','Weight loss','Blood sugar control','Cardiovascular protection','Metabolic syndrome','Appetite suppression','Body weight reduction','NASH / fatty liver','Lipid management'],
  research_areas = ARRAY['metabolic','weight_management','hormonal']
WHERE slug = 'retatrutide';

UPDATE compounds SET
  aliases = ARRAY['TP-7','Selank peptide','Tuftsin analog','Anxiolytic peptide','Anti-anxiety peptide','Selank nootropic'],
  studied_for = ARRAY['Generalized anxiety disorder','Stress reduction','Cognition / attention enhancement','BDNF upregulation','Memory improvement','Focus enhancement','Depression research','Immunomodulation','Neurotrophic effects','Enkephalin modulation','Anti-anxiety','GABA modulation','Calm and relaxation'],
  research_areas = ARRAY['cognitive','immune','sleep','hormonal']
WHERE slug = 'selank';

UPDATE compounds SET
  aliases = ARRAY['Ozempic','Wegovy','Rybelsus','NN9535','Semaglutide acetate','GLP-1 agonist','Ozempic injection','Wegovy injection','Injectable weight loss','Diabetes drug'],
  studied_for = ARRAY['Type 2 diabetes','Chronic weight management','Cardiovascular risk reduction','Obesity treatment','Blood sugar control','Appetite suppression','NASH / fatty liver','Kidney protection','Heart failure reduction','Weight loss injection','Lean body mass preservation','GLP-1 therapy'],
  research_areas = ARRAY['metabolic','weight_management','hormonal','immune']
WHERE slug = 'semaglutide';

UPDATE compounds SET
  aliases = ARRAY['Semax peptide','ACTH 4-10 analog','ACTH fragment','N-Pro-Gly-Pro','Semax nootropic','Russian nootropic'],
  studied_for = ARRAY['Ischemic stroke recovery','Cognition / memory','Optic nerve / CNS disorders','ADHD research','Brain fog','Focus enhancement','BDNF upregulation','NGF upregulation','Neuroprotection','Cognitive performance','Anxiety reduction','Mood improvement','Neuroplasticity'],
  research_areas = ARRAY['cognitive','immune','healing']
WHERE slug = 'semax';

UPDATE compounds SET
  aliases = ARRAY['GRF 1-29','Sermorelin Acetate','Geref','Growth hormone releasing factor 1-29','GHRH 1-29 amide','GHRH analog','Growth hormone secretagogue'],
  studied_for = ARRAY['Pituitary GH-reserve diagnostic','Pediatric GH deficiency','Adult GH-axis / aging research','Growth hormone release','Anti-aging','Muscle growth','Fat loss','Body composition','Sleep quality','IGF-1 elevation','Bone density','Recovery','Energy levels'],
  research_areas = ARRAY['performance','longevity','metabolic','sleep','bone_joint','hormonal']
WHERE slug = 'sermorelin';

UPDATE compounds SET
  aliases = ARRAY['Acetyl Octapeptide-3','SNAP 8','Snap8','Acetyl octapeptide','Botox alternative peptide','Expression line peptide','Anti-expression peptide','SNARE inhibitor peptide'],
  studied_for = ARRAY['Topical anti-wrinkle','Expression lines','Forehead lines','Crow''s feet','Frown lines','Anti-aging topical','Botulinum toxin alternative','Neuromuscular junction modulation','Wrinkle depth reduction','Facial muscle relaxation'],
  research_areas = ARRAY['cosmetic']
WHERE slug = 'snap-8';

UPDATE compounds SET
  aliases = ARRAY['Elamipretide','MTP-131','Bendavia','SS31','SS-31 peptide','Szeto-Schiller peptide','Cardiolipin binder'],
  studied_for = ARRAY['Primary mitochondrial disease','Barth syndrome','Heart failure / ischemia-reperfusion','Dry AMD','Mitochondrial aging','Mitochondrial dysfunction','Oxidative stress','Energy production','Cardiac protection','Renal protection','Muscle weakness','Neurodegeneration','Aging / longevity','Eye disease research'],
  research_areas = ARRAY['longevity','mitochondrial','healing','cognitive','metabolic']
WHERE slug = 'ss-31';

UPDATE compounds SET
  aliases = ARRAY['BI 456906','BI-456906','Dual GLP-1 glucagon agonist','MASH drug','Survodutide peptide'],
  studied_for = ARRAY['Obesity treatment','Type 2 diabetes','MASH / liver disease','NAFLD','Fatty liver','Weight loss','Blood sugar control','Hepatic fat reduction','Metabolic syndrome','Cardiovascular risk'],
  research_areas = ARRAY['metabolic','weight_management','hormonal']
WHERE slug = 'survodutide';

UPDATE compounds SET
  aliases = ARRAY['TB500','TB-500','Thymosin Beta-4','Thymosin B4','Tbeta4','Tβ4','Thymosin B4 Acetate','TB 500','Thymosin beta4'],
  studied_for = ARRAY['Wound healing','Cardiac repair','Tendon healing','Ligament repair','Muscle recovery','Hair growth stimulation','Corneal healing','Dermal healing','Angiogenesis','Anti-inflammatory','Nerve repair','Sports injury','Joint pain','Scarring reduction','Systemic healing','Actin regulation'],
  research_areas = ARRAY['healing','tissue_repair','pain_inflammation','bone_joint','cosmetic','immune']
WHERE slug = 'tb-500';

UPDATE compounds SET
  aliases = ARRAY['Egrifta','Egrifta SV','TH9507','Tesamorelin acetate','GHRH analog','Stabilized GHRH','HIV lipodystrophy drug'],
  studied_for = ARRAY['HIV-associated lipodystrophy (approved)','Hepatic fat / NAFLD','Visceral fat reduction','Cognition research','Growth hormone release','IGF-1 elevation','Anti-aging','Body composition','Metabolic syndrome','Abdominal fat reduction','Cognitive function in aging'],
  research_areas = ARRAY['performance','metabolic','weight_management','bone_joint','cognitive','longevity']
WHERE slug = 'tesamorelin';

UPDATE compounds SET
  aliases = ARRAY['Thymus polypeptide bioregulator','Thymus extract','Thymic bioregulator','Thymalin peptide','Thymus gland peptide'],
  studied_for = ARRAY['Immunosenescence','Immune restoration','Infection resistance','T-cell function','Anti-aging immunity','Longevity','Thymus involution research','Immune system rejuvenation','Cancer immune support','Chronic infection research'],
  research_areas = ARRAY['longevity','immune','healing']
WHERE slug = 'thymalin';

UPDATE compounds SET
  aliases = ARRAY['Thymalfasin','Zadaxin','Talpha1','Tα1','Thymosin Alpha 1','TA1','Thymosin alpha-1 acetate'],
  studied_for = ARRAY['Chronic hepatitis B','Chronic hepatitis C','Cancer immune adjunct','Vaccine adjuvant','Sepsis / severe infection','COVID-19 immune support','HBV treatment','HCV treatment','Immunodeficiency','T-cell activation','Autoimmune modulation','Tumor immunology','Dendritic cell maturation'],
  research_areas = ARRAY['immune','longevity','gut_health','pain_inflammation','healing']
WHERE slug = 'thymosin-alpha-1';

UPDATE compounds SET
  aliases = ARRAY['Mounjaro','Zepbound','LY3298176','LY-3298176','Twincretin','Dual GIP GLP-1 agonist','Tirzepatide injection','GIP GLP-1'],
  studied_for = ARRAY['Type 2 diabetes','Chronic weight management','Obstructive sleep apnea in obesity','Obesity treatment','Blood sugar control','Cardiovascular protection','Appetite suppression','Weight loss','NASH / fatty liver','Kidney protection','Body weight reduction'],
  research_areas = ARRAY['metabolic','weight_management','sleep','hormonal','immune']
WHERE slug = 'tirzepatide';

UPDATE compounds SET
  aliases = ARRAY['Vasoactive Intestinal Peptide','Aviptadil','RLF-100','VIP peptide','Vasoactive intestinal polypeptide'],
  studied_for = ARRAY['ARDS / respiratory failure','Pulmonary hypertension','Sarcoidosis','Erectile dysfunction (intracavernosal)','Immune modulation','GI motility','Neuroprotection','Anti-inflammatory','Lung disease research','Inflammatory bowel disease','COVID-19 research','Bronchodilation'],
  research_areas = ARRAY['immune','gut_health','sexual_health','cognitive','pain_inflammation']
WHERE slug = 'vip';

UPDATE compounds SET
  aliases = ARRAY['Methylcobalamin','Cyanocobalamin','Cobalamin','Vitamin B-12','B12 injection','Hydroxocobalamin','Adenosylcobalamin'],
  studied_for = ARRAY['B12 deficiency / pernicious anemia','Megaloblastic anemia','Neuropathy support','Energy levels','Fatigue','Cognitive function','Mood regulation','DNA synthesis','Cardiovascular health (homocysteine)','Nerve health','Athletic performance','Methylation support','Brain health'],
  research_areas = ARRAY['metabolic','immune','cognitive','performance']
WHERE slug = 'b12';

UPDATE compounds SET
  aliases = ARRAY['5-Amino-1-methylquinolinium','5A1MQ','5-amino-1MQ','NNMT inhibitor','NAD+ precursor support','Nicotinamide N-methyltransferase inhibitor'],
  studied_for = ARRAY['Obesity / metabolic syndrome','Fat-loss / energy-expenditure research','NAD+ metabolism enhancement','NNMT inhibition','Metabolic rate increase','Fat mass reduction','Insulin sensitivity','Stem cell activation','Anti-obesity','Adipogenesis inhibition','Energy expenditure','Weight management'],
  research_areas = ARRAY['metabolic','weight_management','mitochondrial','longevity']
WHERE slug = '5-amino-1mq';

UPDATE compounds SET
  aliases = ARRAY['Copper Tripeptide-3','AHK-CU','AHK copper','Alanine-histidine-lysine copper','Hair copper peptide','GHK-Cu analog hair'],
  studied_for = ARRAY['Hair follicle growth / restoration','Alopecia treatment research','Hair loss','Dermal regeneration','Hair regrowth','Scalp health','Follicle stimulation','Hair thickening','Anti-hair-loss','Dermal repair'],
  research_areas = ARRAY['cosmetic','healing','tissue_repair']
WHERE slug = 'ahk-cu';

UPDATE compounds SET
  aliases = ARRAY['Acadesine','AICA-riboside','AICAR nucleotide','5-aminoimidazole-4-carboxamide ribonucleotide','AMPK activator','Exercise mimetic'],
  studied_for = ARRAY['AMPK / metabolic-stress research','Insulin-resistance models','Endurance research','Fat oxidation','Exercise performance','Metabolic conditioning','Diabetes research','Cardiac protection','Energy metabolism','Cancer metabolism research'],
  research_areas = ARRAY['metabolic','performance','mitochondrial','weight_management']
WHERE slug = 'aicar';

UPDATE compounds SET
  aliases = ARRAY['Cibinetide','ARA290','ARA 290','Non-hematopoietic EPO peptide','EPO tissue protection peptide','Innate repair receptor agonist'],
  studied_for = ARRAY['Small-fiber neuropathy','Neuropathic pain','Tissue-injury repair','Diabetic neuropathy','Sarcoidosis neuropathy','Pain relief','Nerve repair','Anti-inflammatory','Organ protection','Ischemia-reperfusion injury'],
  research_areas = ARRAY['healing','immune','pain_inflammation','cognitive']
WHERE slug = 'ara-290';

UPDATE compounds SET
  aliases = ARRAY['AM833','Cagrilintide peptide','Long-acting amylin analog','Amylin receptor agonist'],
  studied_for = ARRAY['Obesity treatment','Type 2 diabetes management','Combination weight loss therapy','Appetite regulation','Satiety enhancement','Blood sugar control','Metabolic syndrome','Body weight reduction'],
  research_areas = ARRAY['metabolic','weight_management','hormonal']
WHERE slug = 'cagrilintide';

UPDATE compounds SET
  aliases = ARRAY['FPF-1070','Cerebrolysin injection','BDNF mimetic','Brain peptide infusion','Neuropeptide hydrolysate','Porcine brain extract'],
  studied_for = ARRAY['Acute ischemic stroke','Traumatic brain injury (TBI)','Vascular dementia','Alzheimer''s type dementia','Neuroprotection','Cognitive enhancement','Brain injury recovery','Memory improvement','BDNF / NGF mimetic effects','Post-stroke rehabilitation','Neurodegenerative disease','Brain fog','Cognitive decline'],
  research_areas = ARRAY['cognitive','healing','longevity','immune']
WHERE slug = 'cerebrolysin';

UPDATE compounds SET
  aliases = ARRAY['Dilute acetic acid diluent','0.6% acetic acid','Acetic acid solution','Peptide diluent acid','Reconstitution acid'],
  studied_for = ARRAY['Reconstituting poorly soluble peptides','Peptide solubility enhancement','Lab reconstitution','IGF-1 reconstitution','Acidic peptide diluent'],
  research_areas = ARRAY[]::text[]
WHERE slug = 'acetic-acid';

UPDATE compounds SET
  aliases = ARRAY['Bac. water','BAC water','Bacteriostatic water for injection','0.9% benzyl alcohol water','Peptide reconstitution water','Sterile diluent','BW'],
  studied_for = ARRAY['Reconstituting lyophilized peptides','Peptide diluent','Injectable peptide preparation','Sterile reconstitution','Lab prep','Multi-dose vial preservation'],
  research_areas = ARRAY[]::text[]
WHERE slug = 'bac-water';
