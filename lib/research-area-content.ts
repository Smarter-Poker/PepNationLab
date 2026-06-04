/**
 * Research Area Hero Content
 *
 * Rich, factual research-use-only overviews for each of the 15 categories
 * surfaced on /research/area/[area]. Content is sourced from peer-reviewed
 * literature (PubMed, NEJM, Lancet, Nature) and regulatory labels (FDA, EMA).
 *
 * Research-use-only: nothing in this file is medical advice or patient-facing
 * guidance. No dosing. Citations are real published sources -- verify before
 * relying on any specific PMID.
 */

export interface AreaContent {
  /** 2-3 paragraph plain-prose overview, research-use-only framing. */
  overview: string;
  /** 4-7 bullet points naming the molecular pathways studied. */
  keyMechanisms: string[];
  /** 5-10 specific research use cases (not patient claims). */
  studiedFor: string[];
  /** 1 paragraph naming the strongest evidence + the weakest areas. */
  evidenceLandscape: string;
  /** Exactly 5 compound slugs in priority order. */
  topCompounds: string[];
  /** 0-3 stack-component patterns where applicable. */
  topStacks?: string[];
  /** 1 paragraph plain-prose covering side-effects, contraindications, WADA. */
  notableSafety: string;
  /** 3-6 peer-reviewed references -- real PubMed, NEJM, JAMA, FDA, EMA. */
  keyReferences: { citation: string; url?: string }[];
  /** Optional Mermaid.js biology pathway diagram. */
  diagram?: string;
}

export const RESEARCH_AREA_CONTENT: Record<string, AreaContent> = {
  tissue_repair: {
    overview:
      'Tissue-repair research examines how small peptides and cytokines accelerate the resolution phase of wound healing in tendon, ligament, muscle, gut mucosa, and skin. The most-studied agents in this category are the body-protective compound BPC-157 (a synthetic pentadecapeptide derived from human gastric juice) and Thymosin Beta-4 (TB-500), an actin-sequestering peptide present in nearly every mammalian cell. Both are investigational in humans, with the bulk of efficacy data drawn from rodent injury models. In parallel, copper-binding tripeptides (GHK-Cu) and the cathelicidin LL-37 are studied for their effects on dermal extracellular matrix turnover, fibroblast recruitment, and antimicrobial defense of compromised skin. Across the category, the unifying biology is a shift from inflammation toward proliferation and remodeling -- driven by angiogenesis, growth-factor receptor upregulation, and modulation of nitric-oxide tone.',
    keyMechanisms: [
      'VEGF-A and eNOS/iNOS upregulation driving angiogenesis at injury sites (BPC-157, TB-500).',
      'Actin G-monomer sequestration and cell-migration cues from Thymosin Beta-4.',
      'Growth-hormone/IGF-1 axis activation supporting collagen synthesis (CJC-1295, IGF-1 LR3).',
      'Fibroblast and keratinocyte recruitment plus copper-dependent lysyl oxidase signaling (GHK-Cu).',
      'Dopamine and serotonin system stabilization in gut and CNS injury models (BPC-157).',
      'Cathelicidin-mediated antimicrobial barrier defense at wound interfaces (LL-37).',
    ],
    studiedFor: [
      'Achilles and patellar tendon injury models.',
      'Medial collateral ligament transection recovery in rats.',
      'Skeletal muscle crush injury and post-exercise recovery (preclinical).',
      'Cutaneous wound closure and burn re-epithelialization.',
      'Gastrointestinal mucosal repair in NSAID-injury models.',
      'Corneal abrasion healing models.',
      'Bone fracture callus formation in rodent models.',
    ],
    evidenceLandscape:
      'The strongest evidence in this category is preclinical: rodent tendon, ligament, and gut injury studies for BPC-157 and TB-500 are consistent, reproducible, and mechanistically grounded. The weakest area is controlled human data -- no peptide in this category is FDA-approved for tissue repair, and the few human case series for BPC-157 (oral, orthopedic) are small and uncontrolled. GHK-Cu has the most human data, but primarily as a cosmetic dermal active rather than as an internal tissue-repair agent.',
    topCompounds: ['bpc-157', 'tb-500', 'ghk-cu', 'igf-1-lr3', 'll-37'],
    topStacks: ['BPC-157 + TB-500', 'BPC-157 + GHK-Cu'],
    notableSafety:
      'BPC-157 and TB-500 have no characterized human adverse-event profile from controlled trials; theoretical pro-angiogenic stacking concerns exist when multiple angiogenic agents are combined. Both fall under WADA S0 (non-approved substance) and TB-500 is explicitly named on the WADA Prohibited List. GHK-Cu carries primarily local irritation and copper-sensitivity considerations. LL-37 at higher concentrations can show cytotoxicity in vitro. None should be assumed safe in pregnancy, active malignancy, or in tested athletes.',
    keyReferences: [
      {
        citation:
          'Sikiric P, et al. Stable gastric pentadecapeptide BPC 157: novel therapy in gastrointestinal tract. Curr Pharm Des. 2011;17(16):1612-32. PMID: 21548867.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/21548867/',
      },
      {
        citation:
          'Goldstein AL, Hannappel E, Sosne G, Kleinman HK. Thymosin beta4: a multi-functional regenerative peptide. Expert Opin Biol Ther. 2012;12(1):37-51. PMID: 22074294.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/22074294/',
      },
      {
        citation:
          'Pickart L, Margolina A. Regenerative and Protective Actions of the GHK-Cu Peptide. Int J Mol Sci. 2018;19(7):1987. PMID: 29986520.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/29986520/',
      },
      {
        citation:
          'Chang CH, et al. The promoting effect of pentadecapeptide BPC 157 on tendon healing involves tendon outgrowth, cell survival, and cell migration. J Appl Physiol. 2011;110(3):774-80. PMID: 21030672.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/21030672/',
      },
      {
        citation:
          'Philp D, Kleinman HK. Animal studies with thymosin beta, a multifunctional tissue repair and regeneration peptide. Ann N Y Acad Sci. 2010;1194:81-6. PMID: 20536453.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/20536453/',
      },
    ],
    diagram: `graph TD;
    Injury[Tissue Injury] --> BPC157(BPC-157);
    Injury --> TB500(Thymosin Beta-4);
    BPC157 --> eNOS[eNOS / iNOS Upregulation];
    BPC157 --> VEGF[VEGF-A Activation];
    TB500 --> Actin[Actin Sequestration];
    eNOS --> Angio[Angiogenesis & Microvascular Repair];
    VEGF --> Angio;
    Actin --> Migration[Fibroblast & Cell Migration];
    Angio --> Repair[Tissue Regeneration];
    Migration --> Repair;
    GHK[GHK-Cu] --> LOX[Lysyl Oxidase];
    LOX --> Collagen[Collagen Cross-linking];
    Collagen --> Repair;
    style Repair fill:#00C4BC,stroke:#000,stroke-width:2px,color:#fff;
    `,
  },

  healing: {
    overview:
      'Healing and recovery research overlaps tissue repair but emphasizes systemic resolution: cytoprotection across organs, reduction of post-injury inflammation, and acceleration of return to homeostatic function. The peptide candidates here are studied for their effects on the gastrointestinal lining, vascular endothelium, and immune-cell trafficking after surgery, trauma, or intense exercise. Beyond BPC-157 and TB-500, this category includes the tissue-protective ARA-290 (cibinetide), a non-erythropoietic erythropoietin derivative engineered to activate the innate-repair receptor without raising hematocrit, and KPV, a C-terminal tripeptide fragment of alpha-MSH with anti-inflammatory activity in colitis and dermatitis models.',
    keyMechanisms: [
      'Innate-repair-receptor (beta-common/EPOR heterocomplex) activation by ARA-290.',
      'Melanocortin-driven NF-kB suppression by KPV.',
      'Gastric and intestinal cytoprotection via prostaglandin-independent pathways (BPC-157).',
      'Endothelial nitric-oxide synthase modulation and microvascular flow restoration.',
      'T-regulatory cell expansion and macrophage polarization toward M2 phenotype.',
      'IGF-1 axis support for protein synthesis during recovery windows.',
    ],
    studiedFor: [
      'Post-surgical anastomotic healing in rodents.',
      'Diabetic peripheral neuropathy pain and small-fiber regeneration (ARA-290).',
      'Inflammatory bowel disease and colitis models (KPV, BPC-157).',
      'Ischemia-reperfusion injury in heart, kidney, and brain.',
      'Recovery of vascular function after endothelial injury.',
      'Sarcoidosis-related neuropathic pain in early-phase human trials (ARA-290).',
    ],
    evidenceLandscape:
      'ARA-290 has the strongest human evidence in this category, having completed multiple Phase 2 trials in diabetic neuropathy and sarcoidosis with reproducible reductions in pain scores and improvement in small-fiber density. BPC-157 and KPV remain preclinical despite a deep rodent literature. The weakest evidence is for combined recovery stacks -- no controlled human trial has evaluated multi-peptide regimens against single-agent controls.',
    topCompounds: ['bpc-157', 'tb-500', 'ara-290', 'kpv', 'll-37'],
    topStacks: ['BPC-157 + TB-500', 'ARA-290 + BPC-157'],
    notableSafety:
      'ARA-290 has been well tolerated in human trials with no clinically significant changes in hematocrit, blood pressure, or platelet count -- a deliberate engineering goal. BPC-157 and TB-500 lack human AE characterization. KPV has shown no significant toxicity in colitis models. All three remain investigational; assume WADA relevance under S0 unless explicitly cleared, and recognize that pro-angiogenic stacking with other tissue-repair agents has theoretical malignancy considerations that have not been clinically resolved.',
    keyReferences: [
      {
        citation:
          'Brines M, et al. ARA 290, a nonerythropoietic peptide engineered from erythropoietin, improves metabolic control and neuropathic symptoms in patients with type 2 diabetes. Mol Med. 2014;20:658-66. PMID: 25387363.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/25387363/',
      },
      {
        citation:
          'Dalmasso G, et al. PepT1-mediated tripeptide KPV uptake reduces intestinal inflammation. Gastroenterology. 2008;134(1):166-78. PMID: 18061177.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18061177/',
      },
      {
        citation:
          'Sikiric P, et al. Brain-gut axis and pentadecapeptide BPC 157: theoretical and practical implications. Curr Neuropharmacol. 2016;14(8):857-865. PMID: 27138887.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/27138887/',
      },
      {
        citation:
          'Heij L, et al. Safety and Efficacy of ARA 290 in Sarcoidosis Patients with Symptoms of Small Fiber Neuropathy. Mol Med. 2012;18:1430-6. PMID: 23168581.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/23168581/',
      },
      {
        citation:
          'Goldstein AL, Hannappel E, Sosne G, Kleinman HK. Thymosin beta4: a multi-functional regenerative peptide. Expert Opin Biol Ther. 2012;12(1):37-51. PMID: 22074294.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/22074294/',
      },
    ],
  },

  metabolic: {
    overview:
      'Metabolic peptide research investigates regulators of glucose disposal, fatty-acid oxidation, hepatic lipid handling, and adipose-tissue endocrine signaling. The category spans approved incretin therapeutics (semaglutide, tirzepatide), GHRH analogs that modulate visceral adipose tissue (tesamorelin), and mitochondrial-derived peptides (MOTS-c, SS-31) that influence systemic insulin sensitivity from the cellular energetics layer. AMPK activators such as AICAR and 5-Amino-1MQ (an NNMT inhibitor) are studied for their effects on energy substrate switching and adipocyte methylation balance. Across the field, the dominant therapeutic question is whether sustained metabolic improvement can be achieved without indefinite pharmacology -- and which peptides modulate underlying biology versus only suppress appetite.',
    keyMechanisms: [
      'GLP-1 and GIP receptor agonism driving glucose-dependent insulin secretion and delayed gastric emptying.',
      'GHRH receptor activation increasing endogenous GH pulses and reducing visceral adipose tissue (tesamorelin).',
      'AMPK pathway activation increasing fatty-acid oxidation and glucose uptake (AICAR, MOTS-c).',
      'NNMT inhibition restoring nicotinamide methylation balance in adipose tissue (5-Amino-1MQ).',
      'Cardiolipin stabilization and mitochondrial bioenergetic recovery (SS-31).',
      'Amylin receptor agonism producing satiety and slowed gastric emptying (cagrilintide).',
    ],
    studiedFor: [
      'Type 2 diabetes glycemic control (HbA1c reduction).',
      'Visceral adiposity in HIV-associated lipodystrophy (tesamorelin, FDA-approved).',
      'Insulin sensitivity in pre-diabetes and metabolic syndrome.',
      'Hepatic steatosis (MASH/NASH) progression markers.',
      'Mitochondrial myopathy in primary mitochondrial disease.',
      'Cardiovascular risk reduction in obesity with established disease (SELECT).',
      'Body composition shifts -- fat mass versus lean mass preservation.',
    ],
    evidenceLandscape:
      'This is the strongest evidence category in the catalog. Semaglutide (STEP, SUSTAIN, SELECT) and tirzepatide (SURPASS, SURMOUNT) have large, well-controlled, multi-year human trials. Tesamorelin has FDA approval for HIV lipodystrophy. The weakest areas are MOTS-c (preclinical only), AICAR (almost entirely animal data, and a discontinued anti-doping concern), and 5-Amino-1MQ (early human exposure only). Mixed evidence sits with SS-31 (now FDA-approved for Barth syndrome but with several large endpoints unmet in heart failure and AMD).',
    topCompounds: ['semaglutide', 'tirzepatide', 'tesamorelin', 'mots-c', '5-amino-1mq'],
    topStacks: ['CagriSema (cagrilintide + semaglutide)', 'Tesamorelin + Ipamorelin'],
    notableSafety:
      'Incretin agents carry class-label warnings for thyroid C-cell tumors (rodent data, MTC contraindication), pancreatitis, gallbladder disease, gastroparesis-like delayed emptying, and -- with concomitant insulin or sulfonylureas -- hypoglycemia. Tesamorelin requires IGF-1 monitoring and is contraindicated in active malignancy and pituitary disorders. AICAR, MOTS-c, and several GHRH analogs are WADA-prohibited. Compounded GLP-1 products are not FDA-evaluated and have different impurity and stability profiles from the approved drugs.',
    keyReferences: [
      {
        citation:
          'Wilding JPH, et al. Once-Weekly Semaglutide in Adults with Overweight or Obesity (STEP 1). N Engl J Med. 2021;384(11):989-1002. PMID: 33567185.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/33567185/',
      },
      {
        citation:
          'Jastreboff AM, et al. Tirzepatide Once Weekly for the Treatment of Obesity (SURMOUNT-1). N Engl J Med. 2022;387(3):205-216. PMID: 35658024.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/35658024/',
      },
      {
        citation:
          'Lincoff AM, et al. Semaglutide and Cardiovascular Outcomes in Obesity without Diabetes (SELECT). N Engl J Med. 2023;389(24):2221-2232. PMID: 37952131.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/37952131/',
      },
      {
        citation:
          'Falutz J, et al. Effects of tesamorelin, a growth hormone-releasing factor analog, in HIV-infected patients with excess abdominal fat. J Clin Endocrinol Metab. 2010;95(9):4291-304. PMID: 20554713.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/20554713/',
      },
      {
        citation:
          'Lee C, et al. The mitochondrial-derived peptide MOTS-c promotes metabolic homeostasis and reduces obesity and insulin resistance. Cell Metab. 2015;21(3):443-54. PMID: 25738459.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/25738459/',
      },
    ],
    diagram: `graph TD;
    GLP1[Semaglutide / GLP-1] --> Pancreas[Pancreas: ↑ Insulin, ↓ Glucagon];
    GLP1 --> Brain[Brain: ↓ Appetite / Satiety];
    GLP1 --> Stomach[Stomach: ↓ Gastric Emptying];
    GIP[Tirzepatide / GIP+GLP-1] --> GLP1;
    GIP --> Adipose[Adipose: ↑ Lipid Buffering];
    MOTS[MOTS-c] --> AMPK[AMPK Activation];
    AICAR[AICAR] --> AMPK;
    AMPK --> Mitochondria[↑ Mitochondrial Biogenesis];
    AMPK --> Muscle[Muscle: ↑ Glucose Uptake];
    style Pancreas fill:#2D3748,stroke:#00C4BC;
    style Brain fill:#2D3748,stroke:#00C4BC;
    style Stomach fill:#2D3748,stroke:#00C4BC;
    style Adipose fill:#2D3748,stroke:#00C4BC;
    style Mitochondria fill:#2D3748,stroke:#00C4BC;
    style Muscle fill:#2D3748,stroke:#00C4BC;
    `
  },

  longevity: {
    overview:
      'Longevity peptide research examines compounds that target the hallmarks of aging: cellular senescence, telomere attrition, mitochondrial dysfunction, and loss of proteostasis. The category spans the Khavinson bioregulators (epithalon, pinealon, thymalin), the senolytic FOXO4-DRI, mitochondrial-targeting SS-31, and the NAD-precursor and antioxidant cofactor space (NAD+, glutathione). A central scientific tension in this category is the divergence between mechanistically grounded preclinical results and the scarcity of controlled long-term human data. Most geroprotector peptides have no randomized controlled trial powered for healthspan outcomes, and the Khavinson cohort studies are decades old and have not been independently replicated.',
    keyMechanisms: [
      'Telomerase (hTERT) upregulation and telomere maintenance (epithalon, in cultured human cells).',
      'FOXO4-p53 protein-protein interaction disruption triggering selective senescent-cell apoptosis (FOXO4-DRI).',
      'Cardiolipin stabilization and reduction of mitochondrial ROS (SS-31).',
      'NAD+ pool restoration supporting sirtuin and PARP enzymatic activity.',
      'Pineal-bioregulator gene expression modulation (epithalon, pinealon).',
      'Thymic involution reversal and immune resilience (thymalin, thymosin alpha-1).',
    ],
    studiedFor: [
      'Cellular senescence and senolysis (preclinical).',
      'Telomere biology in cultured human fibroblasts.',
      'Age-related immune decline and thymic restoration.',
      'Mitochondrial decline with aging.',
      'Sarcopenia-adjacent muscle proteostasis.',
      'Sleep architecture and circadian regulation in older cohorts.',
      'Neurodegeneration risk markers (preclinical).',
    ],
    evidenceLandscape:
      'The strongest evidence is for SS-31 (FDA-approved for Barth syndrome in 2025, with the deepest mechanistic literature in mitochondrial biology), and Thymosin Alpha-1 (approved abroad for hepatitis B and severe sepsis-related immune suppression, with thousands of treated patients). The weakest evidence is for FOXO4-DRI (entirely preclinical) and Khavinson peptides (limited, non-independent, often single-cohort human data). NAD+ has rich biology but inconsistent results in human supplementation trials.',
    topCompounds: ['epithalon', 'ss-31', 'foxo4-dri', 'thymalin', 'nad'],
    topStacks: ['Epithalon + Thymalin (Khavinson pairing)'],
    notableSafety:
      'Senolytic strategies (FOXO4-DRI) carry theoretical risks of off-target apoptosis. Telomerase upregulation (epithalon) is mechanistically dual-edged given telomerase activity in malignant cells. SS-31 is generally well tolerated in trials with injection-site and mild GI effects. NAD+ infusions can cause infusion-related discomfort and flushing. None of the Khavinson peptides have a robust adverse-event profile; absence of documented harm is not equivalent to documented safety. Almost all longevity peptides remain research-use-only outside approved labels.',
    keyReferences: [
      {
        citation:
          'Khavinson VK, et al. Peptide promotes overcoming of the division limit in human somatic cell. Bull Exp Biol Med. 2004;137(5):473-7. PMID: 15455127.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/15455127/',
      },
      {
        citation:
          'Baar MP, et al. Targeted Apoptosis of Senescent Cells Restores Tissue Homeostasis in Response to Chemotoxicity and Aging. Cell. 2017;169(1):132-147.e16. PMID: 28340339.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/28340339/',
      },
      {
        citation:
          'Karaa A, et al. Randomized dose-escalation trial of elamipretide in adults with primary mitochondrial myopathy. Neurology. 2018;90(14):e1212-e1221. PMID: 29500292.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/29500292/',
      },
      {
        citation:
          'Anisimov VN, Khavinson VK. Peptide bioregulation of aging: results and prospects. Biogerontology. 2010;11(2):139-49. PMID: 19690988.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/19690988/',
      },
      {
        citation:
          'Martens CR, et al. Chronic nicotinamide riboside supplementation is well-tolerated and elevates NAD+ in healthy middle-aged and older adults. Nat Commun. 2018;9(1):1286. PMID: 29599478.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/29599478/',
      },
    ],
  },

  cosmetic: {
    overview:
      'Skin and hair peptide research focuses on extracellular matrix remodeling, melanogenesis modulation, hair-follicle cycling, and dermal pigmentation. Copper-binding tripeptides (GHK-Cu, AHK-Cu) are the most-studied class, with decades of cosmetic-active literature on collagen and proteoglycan synthesis, anti-oxidant effects, and wound contraction. Adjacent compounds include SNAP-8, an acetyl-octapeptide marketed as a topical neuromuscular inhibitor of glabellar lines, and the melanocortin agonists. Most cosmetic peptide evidence is topical-formulation data; injectable use carries different pharmacokinetics and is largely off-label or research-only.',
    keyMechanisms: [
      'Copper-dependent lysyl oxidase activation supporting collagen cross-linking (GHK-Cu).',
      'Fibroblast recruitment and proteoglycan synthesis at dermal wound sites.',
      'Hair-follicle dermal papilla stimulation and anagen-phase extension.',
      'SNARE-complex competitive inhibition reducing acetylcholine release at neuromuscular junctions (SNAP-8, topical).',
      'Melanocortin-1 receptor agonism increasing eumelanin synthesis (afamelanotide class).',
      'Antioxidant response element (Nrf2) activation in keratinocytes (GHK-Cu).',
    ],
    studiedFor: [
      'Photoaging and dermal collagen restoration.',
      'Androgenic alopecia hair-density markers.',
      'Wound contraction and post-procedural skin recovery.',
      'Glabellar and periorbital fine-line topical applications.',
      'Hyperpigmentation and uneven skin tone (melanocortin agents).',
      'Cutaneous antioxidant defense and barrier repair.',
    ],
    evidenceLandscape:
      'GHK-Cu has the strongest evidence base of any peptide in cosmetic dermatology, with multiple controlled topical-formulation trials showing improvements in skin firmness, fine lines, and pigmentation markers. SNAP-8 has cosmetic-industry-funded studies showing modest topical effects on glabellar lines but limited independent replication. Afamelanotide is EMA- and FDA-approved for erythropoietic protoporphyria. The weakest evidence is for injectable cosmetic protocols and for any peptide claim related to scalp hair regrowth where direct trials against minoxidil or finasteride do not exist.',
    topCompounds: ['ghk-cu', 'ahk-cu', 'snap-8', 'bpc-157', 'tb-500'],
    topStacks: ['GHK-Cu + AHK-Cu (skin + hair pairing)'],
    notableSafety:
      'Topical GHK-Cu and AHK-Cu are well tolerated with rare allergic dermatitis and theoretical copper-accumulation concerns at sustained high concentrations. SNAP-8 topical exposure has minimal systemic absorption. Injectable use of any cosmetic-class peptide is off-label and lacks safety characterization. Melanocortin agonists carry pigmentation, GI, and cardiovascular cautions documented in the afamelanotide label. None of these compounds are appropriate for use in pregnancy without prescriber oversight.',
    keyReferences: [
      {
        citation:
          'Pickart L, Margolina A. Regenerative and Protective Actions of the GHK-Cu Peptide in the Light of the New Gene Data. Int J Mol Sci. 2018;19(7):1987. PMID: 29986520.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/29986520/',
      },
      {
        citation:
          'Blanes-Mira C, et al. A synthetic hexapeptide (Argireline) with antiwrinkle activity. Int J Cosmet Sci. 2002;24(5):303-10. PMID: 18494888.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18494888/',
      },
      {
        citation:
          'Langton AK, et al. A new wrinkle on old skin: the role of elastic fibres in skin ageing. Int J Cosmet Sci. 2010;32(5):330-9. PMID: 20572883.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/20572883/',
      },
      {
        citation:
          'Langan EA, et al. Mind the (Gender) Gap: Does Prolactin Exert Gender and/or Site-Specific Effects on the Human Hair Follicle? J Invest Dermatol. 2010;130(3):886-91. PMID: 19890343.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/19890343/',
      },
      {
        citation:
          'Langendonk JG, et al. Afamelanotide for Erythropoietic Protoporphyria. N Engl J Med. 2015;373(1):48-59. PMID: 26132941.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/26132941/',
      },
    ],
  },

  cognitive: {
    overview:
      'Cognitive peptide research examines neuropeptides and neurotrophic peptide mixtures studied for memory, attention, mood, and neuroprotection. The flagship investigational agent is Cerebrolysin, a porcine-brain-derived peptide preparation with decades of European clinical use in stroke and dementia. Selank and Semax are short Russian-developed regulatory peptides studied for anxiolytic and nootropic effects. Other compounds in this category include DSIP (delta sleep-inducing peptide) for sleep-cognition interactions, Pinealon for neuroprotection in oxidative-stress models, and VIP for cholinergic and inflammatory modulation in the CNS. Most cognitive peptide evidence is preclinical or single-center clinical work outside North America.',
    keyMechanisms: [
      'BDNF and NGF-like neurotrophic signaling supporting neuronal survival (Cerebrolysin, Semax).',
      'Tuftsin-derived immunomodulatory and anxiolytic activity via GABA-A potentiation (Selank).',
      'Melanocortin and dopaminergic modulation in cortical and limbic circuits (Semax).',
      'Antioxidant gene expression and reduced ROS in hypoxia models (Pinealon).',
      'VIP-receptor signaling reducing neuroinflammation and tau pathology.',
      'Sleep-architecture restoration and slow-wave promotion (DSIP).',
    ],
    studiedFor: [
      'Acute ischemic stroke functional recovery (Cerebrolysin).',
      'Vascular and Alzheimer-type dementia symptom markers.',
      'Generalized anxiety and stress reactivity (Selank).',
      'ADHD-spectrum attention and working-memory tasks (Semax).',
      'Post-concussion cognitive recovery (preclinical).',
      'Age-related mild cognitive impairment (Cerebrolysin).',
      'Diabetic and ischemic neuropathies (VIP-class).',
    ],
    evidenceLandscape:
      'Cerebrolysin has the largest evidence base, including multiple Cochrane-reviewed trials in acute ischemic stroke and vascular dementia, with mixed but generally positive small-to-moderate effect sizes. Selank and Semax have Russian-language clinical literature that is methodologically uneven and rarely independently replicated outside Russia. DSIP has older European work and very thin contemporary evidence. The weakest evidence is for combination nootropic stacks, none of which have controlled human trials.',
    topCompounds: ['cerebrolysin', 'selank', 'semax', 'dsip', 'pinealon'],
    notableSafety:
      'Cerebrolysin is generally well tolerated with rare hypersensitivity and infusion-related effects; not available in the US. Selank and Semax have low reported AE profiles in Russian studies but limited Western pharmacovigilance. DSIP and Pinealon lack robust safety datasets. None of these peptides are FDA-approved; cognitive use is investigational. Avoid in pregnancy and where concurrent psychotropic therapy could be affected.',
    keyReferences: [
      {
        citation:
          'Bornstein NM, et al. Safety and efficacy of Cerebrolysin in early post-stroke recovery: a meta-analysis of nine randomized clinical trials. Neurol Sci. 2018;39(4):629-640. PMID: 29362966.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/29362966/',
      },
      {
        citation:
          'Heiss WD, et al. Cerebrolysin in patients with acute ischemic stroke in Asia (CASTA): a double-blind, placebo-controlled trial. Stroke. 2012;43(3):630-6. PMID: 22282537.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/22282537/',
      },
      {
        citation:
          'Kolomin T, et al. The temporary dynamics of inflammation-related genes expression under tuftsin analog Selank action. Mol Immunol. 2014;58(1):50-5. PMID: 24291243.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/24291243/',
      },
      {
        citation:
          'Levitskaya NG, et al. Effects of heptapeptide Semax on learning and memory in rats. Neurosci Behav Physiol. 2002;32(4):355-60. PMID: 12206421.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12206421/',
      },
      {
        citation:
          'Schneider-Helmert D, Schoenenberger GA. Effects of DSIP in man. Multifunctional psychophysiological properties besides induction of natural sleep. Neuropsychobiology. 1983;9(4):197-206. PMID: 6646394.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/6646394/',
      },
    ],
  },

  immune: {
    overview:
      'Immune-modulation peptide research focuses on peptides that restore immune competence in immunocompromised states, dampen excessive inflammation, or recruit specific cellular subsets (T-regs, M2 macrophages). The category centers on Thymosin Alpha-1 (Zadaxin) and Thymalin, both derived from or modeled on thymic peptide extracts, with decades of clinical use in chronic hepatitis B, sepsis-associated immunosuppression, and as adjuvants in cancer immunotherapy. Adjacent compounds include the antimicrobial cathelicidin LL-37, the broad-spectrum anti-inflammatory KPV, VIP for neuroimmune signaling, and ARA-290 for innate-repair receptor activation. Across the category, the research question is selective immune restoration without unleashing autoimmunity or cytokine storm.',
    keyMechanisms: [
      'TLR9 activation and Th1 cytokine shift restoring antiviral immunity (thymosin alpha-1).',
      'Thymic epithelial cell support and CD4/CD8 T-cell maturation (thymalin).',
      'Cathelicidin antimicrobial defense against bacterial, fungal, and viral pathogens (LL-37).',
      'Melanocortin pathway suppression of NF-kB and IL-1beta (KPV).',
      'VPAC1/VPAC2 signaling shifting macrophages from M1 to M2 phenotype.',
      'Innate-repair receptor signaling reducing tissue inflammation without immunosuppression (ARA-290).',
    ],
    studiedFor: [
      'Chronic hepatitis B viral suppression (thymosin alpha-1, approved abroad).',
      'Sepsis-associated immune paralysis.',
      'Adjuvant for cancer immunotherapy and chemotherapy recovery.',
      'Severe COVID-19 immune modulation (thymosin alpha-1, observational).',
      'Recurrent respiratory infection susceptibility.',
      'Inflammatory bowel disease and colitis models (KPV).',
      'Skin and gut microbiome host-defense (LL-37).',
    ],
    evidenceLandscape:
      'Thymosin Alpha-1 has the strongest evidence base: multiple controlled trials in chronic hepatitis B and large observational datasets in sepsis. It is approved in over 30 countries. Thymalin has Russian and Eastern European clinical work spanning decades but limited Western replication. ARA-290 has clean Phase 2 data in sarcoidosis and diabetic neuropathy. LL-37 is mechanistically well-characterized but has limited controlled clinical use. KPV remains preclinical for systemic use.',
    topCompounds: ['thymosin-alpha-1', 'thymalin', 'll-37', 'kpv', 'ara-290'],
    topStacks: ['Thymalin + Thymosin Alpha-1'],
    notableSafety:
      'Thymosin Alpha-1 is generally well tolerated with rare local injection reactions; theoretical autoimmune-flare concern in autoimmune disease. Thymalin has a low reported AE profile in Russian datasets. LL-37 at supra-physiologic concentrations shows cytotoxicity in vitro. KPV has no characterized human AE profile. ARA-290 was specifically engineered to avoid erythropoiesis-related effects. None of these agents should be combined with active immunosuppressive therapy without prescriber oversight.',
    keyReferences: [
      {
        citation:
          'Camerini R, Garaci E. Historical review of thymosin alpha 1 in infectious diseases. Expert Opin Biol Ther. 2015;15 Suppl 1:S117-27. PMID: 26218196.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/26218196/',
      },
      {
        citation:
          'Liu Y, et al. Thymosin alpha 1 reduces the mortality of severe COVID-19 by restoration of lymphocytopenia and reversion of exhausted T cells. Clin Infect Dis. 2020;71(16):2150-2157. PMID: 32442287.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/32442287/',
      },
      {
        citation:
          'Brines M, Cerami A. The receptor that tames the innate immune response. Mol Med. 2012;18:486-96. PMID: 22183892.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/22183892/',
      },
      {
        citation:
          'Kahlenberg JM, Kaplan MJ. Little peptide, big effects: the role of LL-37 in inflammation and autoimmune disease. J Immunol. 2013;191(10):4895-901. PMID: 24185823.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/24185823/',
      },
      {
        citation:
          'Romanova IV, et al. Effects of thymalin on the immune system in radiation-exposed and aged organisms. Adv Gerontol. 2012;25(2):245-9.',
      },
    ],
  },

  sexual_health: {
    overview:
      'Sexual-health peptide research targets the hypothalamic-pituitary-gonadal axis, central pro-sexual signaling, and pair-bonding neurochemistry. The category includes kisspeptin-10 (a key upstream GnRH driver studied for hypothalamic-amenorrhea diagnostics and fertility), HCG and HMG (gonadotropin therapeutics used in fertility and hypogonadism), oxytocin (FDA-approved for obstetric use, investigational for social-bonding behaviors), and the melanocortin agonist family. PT-141 (bremelanotide) is the FDA-approved melanocortin-4-receptor agonist for hypoactive sexual desire disorder in premenopausal women. The category emphasizes endocrine signaling rather than direct vasodilation -- distinguishing peptide approaches from PDE5-inhibitor pharmacology.',
    keyMechanisms: [
      'GnRH neuron activation via Kiss1R/GPR54 signaling (kisspeptin-10).',
      'LH-receptor and FSH-receptor agonism driving gonadal steroidogenesis (HCG, HMG).',
      'Oxytocin receptor activation in paraventricular nucleus, amygdala, and uterus.',
      'Melanocortin-4-receptor signaling in central pro-sexual pathways (bremelanotide).',
      'GHRH-axis support for IGF-1 and downstream gonadal trophic effects (sermorelin, CJC-1295).',
    ],
    studiedFor: [
      'Hypothalamic amenorrhea diagnostic stimulation testing (kisspeptin-10).',
      'Male hypogonadism gonadotropin support (HCG).',
      'Female and male infertility ovulation/spermatogenesis induction (HCG, HMG).',
      'Hypoactive sexual desire disorder in premenopausal women (bremelanotide, FDA-approved).',
      'Autism-spectrum social-cognition research (oxytocin, investigational).',
      'Postpartum bonding and labor induction (oxytocin, approved obstetric).',
    ],
    evidenceLandscape:
      'HCG, HMG, oxytocin, and bremelanotide are FDA-approved with extensive label data. Kisspeptin-10 has well-conducted UK and US academic stimulation-test trials. The weakest evidence sits with off-label biohacking protocols combining peptides outside the validated endocrine indications. Sermorelin and CJC-1295 are sometimes positioned for sexual-health benefit, but direct controlled trials in libido or erectile function are absent.',
    topCompounds: ['kisspeptin-10', 'hcg', 'hmg', 'oxytocin', 'sermorelin'],
    notableSafety:
      'HCG and HMG carry ovarian hyperstimulation syndrome risk in fertility protocols. Bremelanotide can cause transient blood-pressure elevation, focal hyperpigmentation, and nausea (label-documented). Oxytocin nasal/IV use carries uterine and cardiovascular cautions. HCG is WADA-prohibited in males. Kisspeptin-10 has a clean safety profile in academic dosing but is not a chronic-use product. None of these peptides are appropriate for use without endocrine evaluation.',
    keyReferences: [
      {
        citation:
          'Abbara A, et al. Kisspeptin-54 Accurately Identifies Hypothalamic Gonadotropin-Releasing Hormone Neuronal Dysfunction in Men with Congenital Hypogonadotropic Hypogonadism. Neuroendocrinology. 2021;111(12):1213-1224. PMID: 33321507.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/33321507/',
      },
      {
        citation:
          'Kingsberg SA, et al. Bremelanotide for the Treatment of Hypoactive Sexual Desire Disorder: Two Randomized Phase 3 Trials. Obstet Gynecol. 2019;134(5):899-908. PMID: 31599840.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/31599840/',
      },
      {
        citation:
          'US FDA. VYLEESI (bremelanotide injection) Prescribing Information. Approved June 2019.',
        url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2019/210557s000lbl.pdf',
      },
      {
        citation:
          'Liu PY, et al. Induction of spermatogenesis and fertility during gonadotropin treatment of gonadotropin-deficient infertile men. J Clin Endocrinol Metab. 2002;87(11):4814-9. PMID: 12414832.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12414832/',
      },
      {
        citation:
          'MacDonald K, MacDonald TM. The peptide that binds: a systematic review of oxytocin and its prosocial effects in humans. Harv Rev Psychiatry. 2010;18(1):1-21. PMID: 20047458.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/20047458/',
      },
    ],
  },

  performance: {
    overview:
      'Performance peptide research centers on the growth-hormone (GH) and IGF-1 axis: GHRH analogs (sermorelin, CJC-1295, tesamorelin), ghrelin-mimetic GH secretagogues (GHRP-2, GHRP-6, hexarelin, ipamorelin), and downstream GH-fragment and IGF-1 derivatives. The unifying mechanism is amplification of endogenous pulsatile GH release rather than exogenous recombinant GH administration. Adjacent agents include follistatin (myostatin antagonism for muscle hypertrophy), AICAR (AMPK-driven endurance phenotype shift), and IGF-1 LR3 (long-acting IGF-1 analog). Every compound in this category is either FDA-approved for a narrow indication (tesamorelin for HIV lipodystrophy) or investigational/research-use-only, and almost all are WADA-prohibited.',
    keyMechanisms: [
      'GHRH receptor agonism increasing GH pulse amplitude (sermorelin, CJC-1295, tesamorelin).',
      'Ghrelin/GHS-R1a receptor agonism producing synergistic GH release (GHRP-2, GHRP-6, ipamorelin, hexarelin).',
      'IGF-1 receptor activation driving protein synthesis and satellite-cell proliferation (IGF-1 LR3).',
      'Myostatin inhibition via follistatin sequestration of activin/myostatin ligands.',
      'AMPK activation increasing mitochondrial biogenesis and endurance phenotype (AICAR).',
    ],
    studiedFor: [
      'Adult growth hormone deficiency.',
      'HIV-associated lipodystrophy visceral adipose reduction (tesamorelin).',
      'Sarcopenia and age-related lean-mass decline.',
      'Body composition shifts in clinical research settings.',
      'Sleep architecture and slow-wave sleep enhancement (GH-axis effects).',
      'Recovery and injury rehabilitation (off-label).',
      'Endurance phenotype and substrate utilization (AICAR, preclinical).',
    ],
    evidenceLandscape:
      'Tesamorelin has FDA approval and the strongest controlled evidence for visceral adiposity. Sermorelin had US approval as a diagnostic and pediatric GH stimulation agent before discontinuation; it remains compounded. Ipamorelin and CJC-1295 have small mechanistic trials but no large efficacy studies. GHRP-2 has Japanese diagnostic approval. Follistatin and IGF-1 LR3 are preclinical in humans. AICAR has substantial animal endurance data but failed human translation and is WADA-banned.',
    topCompounds: ['cjc-1295-no-dac', 'ipamorelin', 'tesamorelin', 'sermorelin', 'igf-1-lr3'],
    topStacks: [
      'CJC-1295 + Ipamorelin (CJC/IPA)',
      'Tesamorelin + Ipamorelin',
      'GHRP-2 + CJC-1295',
    ],
    notableSafety:
      'GH-axis activation carries class concerns: increased fasting glucose and insulin resistance, water retention, carpal-tunnel symptoms, arthralgia, and -- in chronic use -- theoretical malignancy considerations via IGF-1 elevation. Tesamorelin is contraindicated in active malignancy, pituitary disorders, and pregnancy. GHRP-6 causes notable hunger (ghrelin-receptor effect). IGF-1 LR3 has hypoglycemia risk. Every GH-axis peptide, follistatin, AICAR, and IGF-1 LR3 are on the WADA Prohibited List.',
    keyReferences: [
      {
        citation:
          'Falutz J, et al. Metabolic effects of a growth hormone-releasing factor in patients with HIV (tesamorelin). N Engl J Med. 2007;357(23):2359-70. PMID: 18057338.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18057338/',
      },
      {
        citation:
          'Teichman SL, et al. Prolonged stimulation of growth hormone and insulin-like growth factor I secretion by CJC-1295, a long-acting analog of GH-releasing hormone, in healthy adults. J Clin Endocrinol Metab. 2006;91(3):799-805. PMID: 16352683.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/16352683/',
      },
      {
        citation:
          'Raun K, et al. Ipamorelin, the first selective growth hormone secretagogue. Eur J Endocrinol. 1998;139(5):552-61. PMID: 9849822.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/9849822/',
      },
      {
        citation:
          'Sinha-Hikim I, et al. Effects of testosterone supplementation on skeletal muscle fiber hypertrophy and satellite cells. J Clin Endocrinol Metab. 2006;91(8):3024-33.',
      },
      {
        citation:
          'World Anti-Doping Agency. The Prohibited List. International Standard. Updated annually.',
        url: 'https://www.wada-ama.org/en/prohibited-list',
      },
    ],
  },

  sleep: {
    overview:
      'Sleep peptide research focuses on regulators of circadian rhythm, slow-wave sleep architecture, and the pineal melatonin system. The category combines well-characterized endocrine agents (melatonin, FDA-recognized as a dietary supplement and prescription in some jurisdictions), the investigational delta-sleep-inducing peptide DSIP, the Khavinson pineal bioregulator epithalon, and indirect sleep modulators including GH-axis agents that increase slow-wave sleep. Research-relevant endpoints include sleep-onset latency, slow-wave sleep duration, REM density, and morning cortisol patterns. Polysomnographic data are the gold standard; most peptide claims in this category rest on either small sleep-lab studies or extrapolation from circadian-rhythm and pineal-physiology mechanisms.',
    keyMechanisms: [
      'MT1 and MT2 melatonin receptor agonism resetting circadian phase.',
      'Pineal melatonin synthesis support (epithalon).',
      'Putative GABAergic and serotonergic modulation promoting slow-wave sleep (DSIP).',
      'GH-axis amplification increasing endogenous slow-wave sleep (ipamorelin, sermorelin).',
      'Cortisol-rhythm modulation reducing evening arousal (selank, melatonin).',
    ],
    studiedFor: [
      'Sleep-onset insomnia and circadian phase disorders.',
      'Jet lag and shift-work sleep disruption.',
      'Slow-wave sleep enhancement in aging cohorts.',
      'Sleep architecture changes in GH-axis investigations.',
      'Sleep-related autonomic dysregulation (DSIP, preclinical).',
      'Pineal aging and melatonin decline (epithalon, preliminary).',
    ],
    evidenceLandscape:
      'Melatonin has the largest evidence base for circadian-phase disorders and short-term insomnia. DSIP has older European sleep-lab data with inconsistent replication. Epithalon has small Russian studies suggesting melatonin restoration in elderly cohorts. GH-axis effects on slow-wave sleep are well-characterized mechanistically (ipamorelin, sermorelin) but not validated as primary sleep therapeutics. The weakest evidence is for combination protocols and any sleep-architecture claim from short-term agents.',
    topCompounds: ['melatonin', 'dsip', 'epithalon', 'ipamorelin', 'sermorelin'],
    notableSafety:
      'Melatonin is generally well tolerated; high doses can cause next-day grogginess, vivid dreams, and theoretical reproductive-hormone modulation. DSIP has a thin AE profile; no major chronic-use safety dataset. Epithalon has limited safety characterization. GH-axis sleep effects come with the GH-axis safety profile (glucose, IGF-1, edema). None of these compounds substitute for evaluation of sleep apnea or restless-legs disorders, which are common confounders.',
    keyReferences: [
      {
        citation:
          'Auld F, et al. Evidence for the efficacy of melatonin in the treatment of primary adult sleep disorders. Sleep Med Rev. 2017;34:10-22. PMID: 28648359.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/28648359/',
      },
      {
        citation:
          'Schneider-Helmert D, Schoenenberger GA. Effects of DSIP in man. Multifunctional psychophysiological properties besides induction of natural sleep. Neuropsychobiology. 1983;9(4):197-206. PMID: 6646394.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/6646394/',
      },
      {
        citation:
          'Korkushko OV, et al. Peptide preparation Epithalamin enhances melatonin synthesis and prolongs life of elderly people. Adv Gerontol. 2007;20(1):74-85.',
      },
      {
        citation:
          'Van Cauter E, et al. Reciprocal interactions between the GH axis and sleep. Growth Horm IGF Res. 2004;14 Suppl A:S10-7. PMID: 15135771.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/15135771/',
      },
      {
        citation:
          'Buscemi N, et al. The efficacy and safety of exogenous melatonin for primary sleep disorders: a meta-analysis. J Gen Intern Med. 2005;20(12):1151-8. PMID: 16423108.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/16423108/',
      },
    ],
  },

  mitochondrial: {
    overview:
      'Mitochondrial peptide research targets the inner-mitochondrial-membrane lipid cardiolipin, mitochondrial-derived peptides (MDPs) encoded within the mitochondrial genome, and cofactors required for electron-transport-chain function. SS-31 (elamipretide) is the most clinically advanced, with FDA approval in 2025 for Barth syndrome, and ongoing investigation in heart failure, dry age-related macular degeneration, and Friedreich ataxia. MOTS-c is a 16-amino-acid mitochondrial-DNA-encoded peptide studied for metabolic-homeostasis effects. SS-31 and MOTS-c are mechanistically complementary: SS-31 stabilizes existing mitochondrial architecture, while MOTS-c acts as a systemic mitokine influencing nuclear gene expression. NAD+ supports the enzymatic substrate pool that drives oxidative phosphorylation and sirtuin signaling.',
    keyMechanisms: [
      'Cardiolipin binding and stabilization of mitochondrial cristae structure (SS-31).',
      'Reduction of mitochondrial reactive oxygen species without indiscriminate scavenging (SS-31).',
      'AMPK pathway activation and metabolic flexibility induction (MOTS-c).',
      'Sirtuin and PARP substrate restoration via NAD+ pool support.',
      'Mitophagy modulation supporting clearance of damaged mitochondria.',
      'Cellular ATP production rescue in mitochondrial myopathy models.',
    ],
    studiedFor: [
      'Barth syndrome (cardiolipin remodeling defect, SS-31 FDA-approved 2025).',
      'Primary mitochondrial myopathy.',
      'Heart failure with reduced ejection fraction (SS-31, mixed endpoints).',
      'Dry age-related macular degeneration and geographic atrophy.',
      'Friedreich ataxia.',
      'Aging-related mitochondrial decline.',
      'Insulin resistance and metabolic syndrome (MOTS-c).',
    ],
    evidenceLandscape:
      'SS-31 has the strongest mitochondrial-peptide evidence: positive primary mitochondrial myopathy data (MMPOWER program), 2025 FDA approval for Barth syndrome, and a large literature on cardiolipin biology. Several large heart-failure and AMD endpoints have not been met. MOTS-c is mechanistically compelling but remains preclinical. NAD+ infusion protocols are widely used commercially but have limited controlled long-term outcome data. Glutathione has weak evidence as a parenteral antioxidant outside specific toxicology indications.',
    topCompounds: ['ss-31', 'mots-c', 'nad', 'glutathione', 'l-carnitine'],
    notableSafety:
      'SS-31 has mild injection-site reactions and headache; generally well tolerated in mitochondrial myopathy trials. MOTS-c lacks human safety data. NAD+ infusions can cause chest pressure, flushing, and nausea during rapid administration. L-Carnitine has been associated with elevated TMAO and theoretical cardiovascular signals at chronic high doses. Glutathione parenteral use has rare bronchospasm and hypersensitivity reports. SS-31, MOTS-c, and several adjacent agents have potential WADA relevance; verify before competitive use.',
    keyReferences: [
      {
        citation:
          'Karaa A, et al. Randomized dose-escalation trial of elamipretide in adults with primary mitochondrial myopathy. Neurology. 2018;90(14):e1212-e1221. PMID: 29500292.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/29500292/',
      },
      {
        citation:
          'Reid Thompson W, et al. A phase 2/3 randomized clinical trial followed by an open-label extension to evaluate the effectiveness of elamipretide in Barth syndrome (TAZPOWER). Genet Med. 2021;23(3):471-478. PMID: 33077895.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/33077895/',
      },
      {
        citation:
          'Lee C, et al. The mitochondrial-derived peptide MOTS-c promotes metabolic homeostasis and reduces obesity and insulin resistance. Cell Metab. 2015;21(3):443-54. PMID: 25738459.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/25738459/',
      },
      {
        citation:
          'Birk AV, et al. The mitochondrial-targeted compound SS-31 re-energizes ischemic mitochondria by interacting with cardiolipin. J Am Soc Nephrol. 2013;24(8):1250-61. PMID: 23813215.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/23813215/',
      },
      {
        citation:
          'Martens CR, et al. Chronic nicotinamide riboside supplementation is well-tolerated and elevates NAD+ in healthy middle-aged and older adults. Nat Commun. 2018;9(1):1286. PMID: 29599478.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/29599478/',
      },
    ],
  },

  weight_management: {
    overview:
      'Weight-management peptide research is the most clinically validated category in the catalog. Incretin-class agents -- GLP-1 receptor agonists (semaglutide), dual GLP-1/GIP agonists (tirzepatide), triple GLP-1/GIP/glucagon agonists (retatrutide), and dual GLP-1/glucagon agonists (survodutide) -- have transformed obesity therapeutics with consistent double-digit percentage weight reductions in large randomized trials. Adjacent compounds include the amylin analog cagrilintide (and its fixed combination CagriSema with semaglutide), the GHRH analog tesamorelin (FDA-approved for HIV-associated visceral adiposity), and the GH-fragment AOD9604 (which failed its Phase 2b obesity endpoint and is now used as a cosmetic-style fat-loss compound with weak evidence). Research distinguishes appetite-driven weight loss from compositional shifts (fat versus lean) and from cardiometabolic outcome improvement.',
    keyMechanisms: [
      'GLP-1 receptor agonism producing satiety, slowed gastric emptying, and glucose-dependent insulin secretion.',
      'GIP receptor co-agonism amplifying lipid handling and insulin sensitivity (tirzepatide).',
      'Glucagon receptor agonism increasing resting energy expenditure (retatrutide, survodutide).',
      'Amylin-receptor agonism producing complementary satiety and slowed emptying (cagrilintide).',
      'GHRH receptor agonism preferentially reducing visceral adipose tissue (tesamorelin).',
      'Putative C-terminal GH-fragment lipolytic signaling at adipocyte beta-3 adrenoceptors (AOD9604, weak human evidence).',
    ],
    studiedFor: [
      'Obesity weight reduction (BMI >=30 or >=27 with comorbidities).',
      'Type 2 diabetes glycemic control with co-incident weight loss.',
      'Cardiovascular risk reduction in obesity with established disease (SELECT trial, semaglutide).',
      'Obstructive sleep apnea in obesity (tirzepatide, FDA-approved for moderate-severe OSA).',
      'MASH/NASH liver-disease endpoints (survodutide, semaglutide).',
      'Prevention of progression from pre-diabetes to type 2 diabetes (tirzepatide SURMOUNT-1 3-year analysis).',
      'HIV-associated visceral adipose tissue reduction (tesamorelin).',
    ],
    evidenceLandscape:
      'This category has the strongest human evidence in the entire peptide field. STEP (semaglutide), SURMOUNT and SURPASS (tirzepatide), SELECT (cardiovascular outcomes), and REDEFINE (CagriSema) are large, multi-center, multi-year randomized controlled trials with consistent results. Retatrutide and survodutide are in Phase 3. The weakest evidence is for AOD9604 (failed pivotal trial) and for compounded GLP-1 products, which are not FDA-evaluated and have different impurity, dosing-accuracy, and stability profiles from the brand-name approved drugs.',
    topCompounds: ['semaglutide', 'tirzepatide', 'retatrutide', 'cagrilintide', 'tesamorelin'],
    topStacks: [
      'CagriSema (cagrilintide + semaglutide)',
      'Tirzepatide + Cagrilintide (investigational)',
    ],
    notableSafety:
      'Incretin agents carry class warnings: thyroid C-cell tumors (rodent data; medullary thyroid carcinoma and MEN 2 contraindication), pancreatitis, gallbladder disease, severe gastroparesis-like delayed emptying, and hypoglycemia when combined with insulin or sulfonylureas. Retatrutide and survodutide show similar GI profiles with additional considerations from glucagon-receptor activity (heart rate, fasting glucose excursions). Cagrilintide has nausea and injection-site profiles consistent with the amylin class. Tesamorelin requires IGF-1 monitoring and is contraindicated in active malignancy, pituitary disorders, and pregnancy. Compounded products are not FDA-evaluated; impurity and labeling-accuracy issues have been documented.',
    keyReferences: [
      {
        citation:
          'Wilding JPH, et al. Once-Weekly Semaglutide in Adults with Overweight or Obesity (STEP 1). N Engl J Med. 2021;384(11):989-1002. PMID: 33567185.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/33567185/',
      },
      {
        citation:
          'Jastreboff AM, et al. Tirzepatide Once Weekly for the Treatment of Obesity (SURMOUNT-1). N Engl J Med. 2022;387(3):205-216. PMID: 35658024.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/35658024/',
      },
      {
        citation:
          'Jastreboff AM, et al. Triple-Hormone-Receptor Agonist Retatrutide for Obesity - A Phase 2 Trial. N Engl J Med. 2023;389(6):514-526. PMID: 37366315.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/37366315/',
      },
      {
        citation:
          'Lincoff AM, et al. Semaglutide and Cardiovascular Outcomes in Obesity without Diabetes (SELECT). N Engl J Med. 2023;389(24):2221-2232. PMID: 37952131.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/37952131/',
      },
      {
        citation:
          'Garvey WT, et al. Tirzepatide once weekly for the treatment of obesity in people with type 2 diabetes (SURMOUNT-2). Lancet. 2023;402(10402):613-626. PMID: 37385275.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/37385275/',
      },
      {
        citation:
          'US FDA. WEGOVY (semaglutide injection) and ZEPBOUND (tirzepatide injection) Prescribing Information.',
        url: 'https://www.accessdata.fda.gov/scripts/cder/daf/',
      },
    ],
  },

  gut_health: {
    overview:
      'Gut-health peptide research investigates compounds that restore mucosal barrier integrity, reduce intestinal inflammation, and modulate the enteric nervous system. BPC-157 is the most-studied agent: derived from a partial sequence of body-protective compound in human gastric juice, it shows reproducible cytoprotection across rodent gastrointestinal injury models including NSAID-induced ulceration, esophagitis, and inflammatory-bowel-disease analogs. KPV (the C-terminal tripeptide of alpha-MSH) shows anti-inflammatory activity in colitis models via PepT1-mediated mucosal uptake and downstream melanocortin signaling. VIP modulates enteric neuro-immune crosstalk, and LL-37 contributes to mucosal antimicrobial defense. Together, these agents target the tight junctions, mucosal immune cells, and enteric neurons that together define gut barrier function.',
    keyMechanisms: [
      'Tight-junction protein expression support (claudin, occludin) restoring barrier integrity (BPC-157).',
      'Endothelial nitric-oxide synthase modulation supporting mucosal microcirculation (BPC-157).',
      'PepT1-mediated mucosal tripeptide uptake delivering anti-inflammatory KPV directly to colonocytes.',
      'NF-kB suppression and IL-1beta downregulation via melanocortin signaling (KPV).',
      'VIP receptor activation balancing enteric neuroimmune signaling and pancreatic exocrine function.',
      'Cathelicidin-mediated antimicrobial defense at the mucosal interface (LL-37).',
      'Dopaminergic stabilization in the brain-gut axis under stress and injury (BPC-157).',
    ],
    studiedFor: [
      'NSAID-induced gastric and intestinal injury (preclinical).',
      'Inflammatory bowel disease models -- DSS-colitis, TNBS-colitis (BPC-157, KPV).',
      'Esophagitis and reflux-related mucosal injury.',
      'Short-bowel and anastomotic-healing models.',
      'Stress-induced ulceration and brain-gut axis dysregulation.',
      'Mucosal microbiome host defense.',
      'Pancreatic injury and exocrine recovery (VIP-class).',
    ],
    evidenceLandscape:
      'BPC-157 has the deepest preclinical literature in gut biology -- dozens of rodent models with consistent findings across labs, primarily from the Sikiric group and collaborators. KPV has rigorous mechanistic work in colitis models. VIP has clinical use as Aviptadil for adjacent indications (ARDS investigational). The weakest evidence is human controlled efficacy data: no peptide in this category is FDA-approved for inflammatory bowel disease or barrier dysfunction, and the few human BPC-157 case series (often oral preparations) are uncontrolled.',
    topCompounds: ['bpc-157', 'kpv', 'vip', 'll-37', 'tb-500'],
    topStacks: ['BPC-157 + KPV (mucosal-repair pairing)', 'BPC-157 + TB-500'],
    notableSafety:
      'BPC-157 has no characterized human adverse-event profile; the oral route has marginally more clinical reporting than the injectable route. KPV has no significant rodent toxicity signal and uses an endogenous transporter (PepT1) for uptake. VIP/Aviptadil has hypotension and flushing as dose-limiting effects in human trials. LL-37 at high concentrations is cytotoxic in vitro. All four remain investigational; pro-angiogenic stacking with TB-500 in patients with active or suspected malignancy is theoretical but not clinically resolved.',
    keyReferences: [
      {
        citation:
          'Sikiric P, et al. Stable gastric pentadecapeptide BPC 157: novel therapy in gastrointestinal tract. Curr Pharm Des. 2011;17(16):1612-32. PMID: 21548867.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/21548867/',
      },
      {
        citation:
          'Dalmasso G, et al. PepT1-mediated tripeptide KPV uptake reduces intestinal inflammation. Gastroenterology. 2008;134(1):166-78. PMID: 18061177.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18061177/',
      },
      {
        citation:
          'Sikiric P, et al. Brain-gut axis and pentadecapeptide BPC 157: theoretical and practical implications. Curr Neuropharmacol. 2016;14(8):857-865. PMID: 27138887.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/27138887/',
      },
      {
        citation:
          'Kannengiesser K, et al. Melanocortin-derived tripeptide KPV has anti-inflammatory potential in murine models of inflammatory bowel disease. Inflamm Bowel Dis. 2008;14(3):324-31. PMID: 18092346.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18092346/',
      },
      {
        citation:
          'Delgado M, Ganea D. Vasoactive intestinal peptide: a neuropeptide with pleiotropic immune functions. Amino Acids. 2013;45(1):25-39. PMID: 21964837.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/21964837/',
      },
    ],
  },

  pain_inflammation: {
    overview:
      'Pain and inflammation peptide research investigates agents that reduce nociceptive signaling, resolve inflammation without indiscriminate immunosuppression, and support nerve regeneration in chronic-pain syndromes. ARA-290 (cibinetide) is the most clinically advanced: a non-erythropoietic erythropoietin derivative engineered to bind the innate-repair receptor (IRR, a beta-common/EPOR heterocomplex) without raising hematocrit. BPC-157 and TB-500 contribute analgesic effects in injury models via tissue-repair acceleration rather than direct nociception modulation. KPV exerts anti-inflammatory effects through the melanocortin pathway. LL-37 modulates inflammation at mucosal interfaces. Together, the category emphasizes upstream inflammation resolution over symptomatic analgesia.',
    keyMechanisms: [
      'Innate-repair-receptor signaling reducing tissue inflammation and supporting small-fiber regeneration (ARA-290).',
      'NF-kB and IL-1beta suppression via melanocortin pathway (KPV).',
      'VEGF-driven microcirculation restoration at injury sites accelerating resolution (BPC-157, TB-500).',
      'Macrophage M1-to-M2 polarization in chronic inflammation (TB-500, ARA-290).',
      'Cathelicidin antimicrobial activity at sites of mucosal inflammation (LL-37).',
      'Dopaminergic and serotonergic stabilization in central pain pathways (BPC-157).',
    ],
    studiedFor: [
      'Diabetic peripheral neuropathy small-fiber regeneration (ARA-290 Phase 2).',
      'Sarcoidosis-related neuropathic pain (ARA-290).',
      'Chronic tendinopathy pain and function (BPC-157, preclinical and uncontrolled human).',
      'Inflammatory bowel disease pain markers (KPV, BPC-157).',
      'Post-surgical inflammation and recovery.',
      'Complex regional pain syndrome (investigational).',
      'Chronic low-back pain and musculoskeletal inflammation (off-label, no controlled trials).',
    ],
    evidenceLandscape:
      'ARA-290 has the strongest evidence in this category: completed Phase 2 trials in diabetic neuropathy (Brines 2014) and sarcoidosis (Heij 2012) with reproducible pain-score reductions and small-fiber density improvements. BPC-157 and TB-500 are preclinical for pain endpoints. KPV has solid mechanistic work in colitis pain models. The weakest evidence is for any peptide claim in chronic non-specific low-back pain or fibromyalgia, where controlled trials do not exist.',
    topCompounds: ['ara-290', 'bpc-157', 'tb-500', 'kpv', 'll-37'],
    topStacks: ['BPC-157 + TB-500', 'ARA-290 + BPC-157 (preclinical synergy)'],
    notableSafety:
      'ARA-290 was deliberately engineered to avoid erythropoiesis effects and has shown clean safety in Phase 2 trials -- no clinically significant changes in hematocrit, platelets, or blood pressure. BPC-157 and TB-500 lack controlled human AE data. KPV has a minimal toxicity signal in preclinical work. LL-37 at high concentrations is cytotoxic. Pro-angiogenic stacking (BPC-157 + TB-500) carries the theoretical malignancy-progression caution noted elsewhere in this catalog. All four agents (BPC-157, TB-500, KPV, ARA-290) are investigational and fall under WADA S0 considerations.',
    keyReferences: [
      {
        citation:
          'Brines M, et al. ARA 290, a nonerythropoietic peptide engineered from erythropoietin, improves metabolic control and neuropathic symptoms in patients with type 2 diabetes. Mol Med. 2014;20:658-66. PMID: 25387363.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/25387363/',
      },
      {
        citation:
          'Heij L, et al. Safety and Efficacy of ARA 290 in Sarcoidosis Patients with Symptoms of Small Fiber Neuropathy: A Randomized, Double-Blind Pilot Study. Mol Med. 2012;18:1430-6. PMID: 23168581.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/23168581/',
      },
      {
        citation:
          'Brines M, Cerami A. The receptor that tames the innate immune response. Mol Med. 2012;18:486-96. PMID: 22183892.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/22183892/',
      },
      {
        citation:
          'Sikiric P, et al. Pentadecapeptide BPC 157 and the central nervous system. Neural Regen Res. 2022;17(3):482-487. PMID: 34380875.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/34380875/',
      },
      {
        citation:
          'Kannengiesser K, et al. Melanocortin-derived tripeptide KPV has anti-inflammatory potential in murine models of inflammatory bowel disease. Inflamm Bowel Dis. 2008;14(3):324-31. PMID: 18092346.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18092346/',
      },
    ],
  },

  bone_joint: {
    overview:
      'Bone and joint peptide research investigates compounds that accelerate tendon, ligament, cartilage, and bone repair, and modulate the GH/IGF-1 axis that drives collagen synthesis and osteoblast activity. BPC-157 is the most-studied agent for tendon and ligament biology, with reproducible rodent data on transected Achilles tendons, medial collateral ligaments, and bone-tendon junctions. TB-500 contributes via actin sequestration and cell-migration cues at tendon and muscle interfaces. GHK-Cu has dedicated literature in cartilage and joint biology, supporting proteoglycan synthesis and decellularization-resistance in osteoarthritis models. IGF-1 LR3 and the GH-axis agents (sermorelin, CJC-1295, ipamorelin) drive collagen and osteoblast activity systemically.',
    keyMechanisms: [
      'Tendon-outgrowth cell survival and migration cues at tenocyte interfaces (BPC-157).',
      'Actin G-monomer sequestration and fibroblast recruitment to musculoskeletal injury sites (TB-500).',
      'Copper-dependent lysyl oxidase activation supporting collagen cross-linking in tendon and bone matrix (GHK-Cu).',
      'IGF-1 receptor signaling driving osteoblast activity and chondrocyte proteoglycan synthesis (IGF-1 LR3).',
      'GH-axis amplification supporting systemic collagen and bone-mineral turnover (CJC-1295, ipamorelin, sermorelin).',
      'VEGF-driven microcirculation restoration at the bone-tendon junction (BPC-157, TB-500).',
    ],
    studiedFor: [
      'Achilles tendon transection and rotator-cuff repair models.',
      'Medial collateral ligament and ACL injury rodent studies.',
      'Bone-tendon junction healing.',
      'Osteoarthritis cartilage biology and proteoglycan markers (GHK-Cu, preclinical).',
      'Bone fracture callus formation (CJC-1295, IGF-1 LR3).',
      'Post-surgical orthopedic recovery (off-label, uncontrolled).',
      'Sarcopenia-adjacent muscle-bone unit decline.',
    ],
    evidenceLandscape:
      'The strongest evidence in bone and joint biology is the BPC-157 tendon literature, with multiple independent rodent studies across Achilles, MCL, and quadriceps tendon models. GHK-Cu has solid in-vitro and in-vivo cartilage data. GH-axis amplification (CJC-1295, ipamorelin) has well-characterized systemic effects on collagen and IGF-1 but no controlled trials for joint or tendon outcomes. The weakest evidence is for any peptide claim in human osteoarthritis or rotator-cuff repair -- controlled trials do not exist, and case-series reports are uncontrolled.',
    topCompounds: ['bpc-157', 'tb-500', 'ghk-cu', 'igf-1-lr3', 'cjc-1295-no-dac'],
    topStacks: [
      'BPC-157 + TB-500 (musculoskeletal repair pairing)',
      'CJC-1295 + Ipamorelin (GH-axis support)',
      'BPC-157 + GHK-Cu',
    ],
    notableSafety:
      'BPC-157 and TB-500 lack human controlled safety data; pro-angiogenic stacking considerations apply. TB-500 is explicitly WADA-prohibited and BPC-157 falls under S0. GHK-Cu has local irritation and theoretical copper-accumulation concerns. IGF-1 LR3 carries hypoglycemia risk and theoretical malignancy considerations from chronic IGF-1 elevation. GH-axis agents (CJC-1295, ipamorelin) carry the GH-axis safety profile: glucose dysregulation, water retention, carpal-tunnel symptoms, and WADA prohibition. None are appropriate for athletes in tested competition or for individuals with active malignancy.',
    keyReferences: [
      {
        citation:
          'Chang CH, et al. The promoting effect of pentadecapeptide BPC 157 on tendon healing involves tendon outgrowth, cell survival, and cell migration. J Appl Physiol. 2011;110(3):774-80. PMID: 21030672.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/21030672/',
      },
      {
        citation:
          'Krivic A, et al. Achilles detachment in rat and stable gastric pentadecapeptide BPC 157: promoted tendon-to-bone healing and opposed corticosteroid aggravation. J Orthop Res. 2006;24(5):982-9. PMID: 16583455.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/16583455/',
      },
      {
        citation:
          'Pickart L, Margolina A. Regenerative and Protective Actions of the GHK-Cu Peptide. Int J Mol Sci. 2018;19(7):1987. PMID: 29986520.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/29986520/',
      },
      {
        citation:
          'Goldstein AL, et al. Thymosin beta4: actin-sequestering protein moonlights to repair injured tissues. Trends Mol Med. 2005;11(9):421-9. PMID: 16099219.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/16099219/',
      },
      {
        citation:
          'Teichman SL, et al. Prolonged stimulation of growth hormone and insulin-like growth factor I secretion by CJC-1295, a long-acting analog of GH-releasing hormone, in healthy adults. J Clin Endocrinol Metab. 2006;91(3):799-805. PMID: 16352683.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/16352683/',
      },
    ],
  },
};
