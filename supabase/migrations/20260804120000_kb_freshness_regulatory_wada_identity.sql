-- Peptide knowledge base freshness pass, 2026-08-04.
-- Sources: WADA 2026 Prohibited List (in force 1 Jan 2026); FDA/company announcements;
-- Sigma-Aldrich SML2832; AbMole M51012; Wikipedia/PubChem CID 10273502.
-- Research-use-only framing preserved. No human dosing guidance added.
-- Applied to project ydsaqnnuwyvtyxgvrnys (PepNationLab) on 2026-08-04.

-- 1. 5-Amino-1MQ: resolve CAS and molecular weight caveat (iodide salt).
update compounds set
  cas_number = '42464-96-0',
  molecular_weight_da = 286.11,
  identity = identity
    || jsonb_build_object(
         'cas', '42464-96-0 (5-amino-1-methylquinolinium iodide; also cited as 685079-15-6)',
         'molecular_weight', '159.21 Da cation (C10H11N2+); 286.11 Da iodide salt (C10H11N2 . I). 1.89 mg of the iodide salt corresponds to 1 mg of 5-Amino-1MQ base.'
       ),
  warnings = 'Strictly investigational with no human approval and no defined human dose. Identity resolved 2026-08-04: the research material is the iodide salt, CAS 42464-96-0, 286.11 Da (cation 159.21 Da); confirm the salt form on the supplier certificate of analysis because potency is quoted on different bases.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = '5-amino-1mq';

-- 2. AHK-Cu: resolve CAS and molecular weight caveat.
update compounds set
  cas_number = '767286-83-9',
  molecular_weight_da = 415.93,
  identity = identity
    || jsonb_build_object(
         'cas', '767286-83-9 (AHK-Cu, copper tripeptide-3); 682809-81-0 (hydrochloride form)',
         'molecular_weight', '354.41 Da free AHK tripeptide; 415.93 Da AHK-Cu complex (C15H24CuN6O4); 452.40 Da hydrochloride form'
       ),
  warnings = 'Recognized as a cosmetic ingredient; same complex-stability caveat as GHK-Cu. Identity resolved 2026-08-04: AHK-Cu is CAS 767286-83-9, 415.93 Da (C15H24CuN6O4); the hydrochloride form is CAS 682809-81-0, 452.40 Da; free AHK tripeptide is 354.41 Da. Confirm which form a certificate of analysis describes, since copper content differs between them.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'ahk-cu';

-- 3. Pinealon: correct the CAS column, which disagreed with the identity record.
update compounds set
  cas_number = '175175-23-2',
  molecular_weight_da = 418.41,
  identity = identity
    || jsonb_build_object(
         'cas', '175175-23-2',
         'molecular_weight', '418.41 Da (C15H26N6O8)'
       ),
  warnings = 'Not approved; preliminary, single-lineage evidence. Research use only. Identity resolved 2026-08-04: Pinealon (EDR, Glu-Asp-Arg) is CAS 175175-23-2, C15H26N6O8, 418.41 Da.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'pinealon';

-- 4. Thymalin: resolve the extract-versus-dipeptide identity ambiguity.
update compounds set
  cas_number = '131183-11-4',
  identity = identity
    || jsonb_build_object(
         'cas', '131183-11-4 (Thymalin, calf thymus polypeptide complex)',
         'sequence', 'Calf thymus low-molecular-weight polypeptide complex; not a single molecule. Constituent dipeptides include Glu-Trp (Thymogen / Oglufanide, CAS 38101-59-6) and Lys-Glu (Vilon, CAS 45234-02-4).',
         'molecular_weight', 'Heterogeneous mixture; roughly 80 to 90 percent of components fall between 600 and 6000 Da'
       ),
  warnings = 'Not FDA or EMA approved; extract composition can vary by source; caution in autoimmunity. Research use only. Identity resolved 2026-08-04: Thymalin is the calf thymus polypeptide complex (CAS 131183-11-4), not a single defined molecule. Material sold as "Thymalin" that is actually the Glu-Trp dipeptide is mislabelled; that dipeptide is properly Thymogen (Oglufanide, CAS 38101-59-6), one constituent isolated from the Thymalin low-molecular-weight fraction. Confirm which material a certificate of analysis describes.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'thymalin';

-- 5. Shred Stack: contains AOD9604, which is named on the WADA 2026 List. Correcting a wrong permitted flag.
update compounds set
  wada_status = 'prohibited',
  risk_level = 'moderate',
  regulatory = 'Not FDA-approved as a stack. Tirzepatide is FDA-approved separately; AOD9604 is not approved anywhere. WADA-prohibited at all times because AOD9604 is named on the 2026 Prohibited List under S2.2.3 (growth hormone fragments), a non-Specified substance.',
  warnings = 'For research use only. Not for human consumption. Contains AOD9604, which is prohibited at all times under WADA 2026 S2.2.3; inherits the tirzepatide thyroid C-cell boxed warning and pancreatitis considerations.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'shred-stack';

-- 6. Semaglutide: oral Wegovy approval and WADA Monitoring Program status.
update compounds set
  regulatory = 'FDA-approved: Ozempic (T2D, 2017); Rybelsus (oral T2D, 2019); Wegovy (obesity, 2021); Ozempic label expanded for CKD risk reduction in T2D (Jan 2025); Wegovy approved for MASH with moderate-to-advanced fibrosis (Aug 2025); Wegovy pill (oral semaglutide 25 mg) approved for chronic weight management and major adverse cardiovascular event risk reduction, US availability from January 2026 -- the first oral GLP-1 receptor agonist approved for weight management. Compounded salt forms (sodium/acetate) cautioned by FDA as not established safe/effective. Not on the WADA 2026 Prohibited List; semaglutide has been on the WADA Monitoring Program since 2024 (monitored, not sanctioned).',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'semaglutide';

-- 7. Tirzepatide: full indication list and WADA Monitoring Program addition.
update compounds set
  regulatory = 'FDA-approved: Mounjaro (T2D, 2022); Zepbound (chronic weight management, 2023); Zepbound approved for moderate-to-severe obstructive sleep apnea in adults with obesity (Dec 2024). Compounded versions are not FDA-evaluated. Not on the WADA 2026 Prohibited List; tirzepatide was added to the WADA Monitoring Program effective 1 January 2026 (monitored, not sanctioned).',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'tirzepatide';

-- 8. Retatrutide: no NDA filed as of this review; align to sponsor guidance.
update compounds set
  regulatory = 'Investigational (Eli Lilly); Phase 3 TRIUMPH program -- TRIUMPH-1 topline results reported May 2026 (2,339 participants, 80 wk; -28.3% mean weight loss at 12 mg; all three doses met primary and key secondary endpoints vs placebo). As of August 2026 no NDA has been filed. Sponsor guidance is an obesity NDA submission in the second half of 2026 and a type 2 diabetes submission in early 2027; FDA has granted Fast Track designation for obesity. Not FDA-approved; non-trial material is research-use-only.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'retatrutide';

-- 9. CagriSema: review timeline and the REDEFINE 4 head-to-head result.
update compounds set
  regulatory = 'Investigational (Novo Nordisk); NDA filed with FDA 18 Dec 2025 on the REDEFINE 1 and REDEFINE 2 pivotal trials and under FDA review through 2026; company guidance points to a decision in Q4 2026, and no PDUFA date has been publicly confirmed. Would be the first once-weekly GLP-1 plus amylin analogue combination for weight management if approved. Note that the Phase 3 REDEFINE 4 head-to-head trial did not meet its primary endpoint of non-inferiority on weight loss versus tirzepatide at 84 weeks. Not approved.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'cagrisema';

-- 10. Cagrilintide: clarify its role in the combination under review.
update compounds set
  regulatory = 'Investigational (Novo Nordisk); not FDA-approved as a single agent. It is the amylin analogue component of CagriSema, which is under FDA review following a December 2025 NDA filing. Not on the WADA 2026 Prohibited List.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'cagrilintide';

-- 11. Survodutide: 2026 Phase 3 readouts.
update compounds set
  regulatory = 'Investigational (Boehringer Ingelheim / Zealand Pharma); not FDA-approved. Phase 3 SYNCHRONIZE-1 reported positive topline results on 28 April 2026, meeting co-primary endpoints with mean weight loss of up to 16.6% at 76 weeks versus 3.2% for placebo (efficacy estimand). Phase 3 SYNCHRONIZE-MASLD met both primary endpoints, with liver fat normalization in about 6 of 10 treated participants at 48 weeks. Full results were presented at the ADA 2026 Scientific Sessions and published in The New England Journal of Medicine and Nature Medicine. Holds FDA Breakthrough Therapy designation for MASH. Not on the WADA 2026 Prohibited List.',
  warnings = 'Investigational with no approved indication or long-term safety data despite positive Phase 3 readouts in 2026; GLP-1 and glucagon class considerations remain under study. Research use only.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'survodutide';

-- 12. SS-31 / elamipretide: approval specifics.
update compounds set
  regulatory = 'FDA accelerated approval 19 September 2025 as Forzinity (elamipretide hydrochloride) to improve muscle strength in adult and pediatric patients with Barth syndrome weighing at least 30 kg; 40 mg subcutaneous once daily. Holds FDA Orphan Drug, Fast Track, Priority Review and Rare Pediatric designations, and an EMA Orphan Drug designation for Barth syndrome. No EMA marketing authorization identified as of August 2026. All other uses remain investigational. Not on the WADA 2026 Prohibited List.',
  warnings = 'The 2025 accelerated approval is narrow (Barth syndrome, patients at least 30 kg); accelerated approval is conditional on confirmatory evidence. All other uses remain investigational and several large trials did not meet their endpoints. Research use only outside approved labeling.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'ss-31';

-- 13. MOTS-c: named on the WADA 2026 List.
update compounds set
  regulatory = 'Not FDA-approved; research chemical. Named on the WADA 2026 Prohibited List under S4.4.1 as "mitochondrial open reading frame of the 12S rRNA-c (MOTS-c)", an AMPK activator; prohibited at all times and a non-Specified substance.',
  warnings = 'Not approved. Named on the WADA 2026 Prohibited List (S4.4.1, AMPK activators), prohibited at all times and non-Specified, which carries the highest sanction tier for a first violation. Evidence is predominantly preclinical. Research use only.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'mots-c';

-- 14. AICAR: correct the WADA section reference.
update compounds set
  regulatory = 'Investigational / research chemical; not DEA-controlled. Named on the WADA 2026 Prohibited List under S4.4.1 (activators of the AMP-activated protein kinase); prohibited at all times and a non-Specified substance.',
  warnings = 'Investigational with no safe non-clinical dose. Named on the WADA 2026 Prohibited List (S4.4.1, AMPK activators), prohibited at all times and non-Specified. Hyperuricemia and gout caution. Research use only.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'aicar';

-- 15. AOD9604: named on the WADA 2026 List.
update compounds set
  regulatory = 'Not FDA-approved (development halted). Named on the WADA 2026 Prohibited List under S2.2.3 (growth hormone fragments, alongside hGH 176-191); prohibited at all times and a non-Specified substance.',
  warnings = 'Failed its pivotal trial; not an approved medicine; a self-affirmed food-additive determination is not FDA drug approval. Named on the WADA 2026 Prohibited List (S2.2.3), prohibited at all times and non-Specified. Research use only.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'aod9604';

-- 16. hGH Fragment 176-191: named on the WADA 2026 List.
update compounds set
  regulatory = 'Not FDA-approved; research chemical. Named on the WADA 2026 Prohibited List under S2.2.3 (growth hormone fragments); prohibited at all times and a non-Specified substance.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'hgh-fragment-176-191';

-- 17. BPC-157: explicitly named in WADA 2026 S0.
update compounds set
  regulatory = 'Not FDA-approved; under FDA compounding-safety review (503A bulk-substances evaluation); research chemical. Named by example on the WADA 2026 Prohibited List under S0 (non-approved substances); prohibited at all times as a Specified substance.',
  warnings = 'Not approved; flagged by the FDA under its 503A bulk-substances compounding-safety review. Named by example under WADA 2026 S0, so it is prohibited at all times in sport. The pro-angiogenic mechanism is a theoretical concern in any malignancy. Research use only.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'bpc-157';

-- 18. TB-500 / Thymosin Beta-4: named on the WADA 2026 List.
update compounds set
  regulatory = 'Not FDA-approved. Named on the WADA 2026 Prohibited List under S2.3 as "Thymosin-beta4 and its derivatives e.g. TB-500"; prohibited at all times and a non-Specified substance.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'tb-500';

-- 19. Follistatin: named on the WADA 2026 List.
update compounds set
  regulatory = 'Not FDA-approved; experimental. Named on the WADA 2026 Prohibited List under S4.3 as a myostatin-binding protein; prohibited at all times and a non-Specified substance.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'follistatin';

-- 20. Kisspeptin-10: confirmed against the 2026 List wording.
update compounds set
  regulatory = 'Not approved; investigational / research reagent. Named on the WADA 2026 Prohibited List under S2.2.1 as "kisspeptin and its agonist analogues", a testosterone-stimulating peptide prohibited in males at all times; non-Specified.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'kisspeptin-10';

-- 21. ARA-290: flag the S2.1.5 interpretation risk without over-claiming.
update compounds set
  regulatory = 'Investigational; FDA orphan designation; not marketed. Not named on the WADA 2026 Prohibited List, but as an erythropoietin-derived innate repair receptor agonist it may fall within S2.1.5, whose examples (asialo EPO, carbamylated EPO) are explicitly non-exhaustive. Competitive athletes should treat its status as unresolved and verify with their anti-doping organization.',
  warnings = 'Investigational with FDA orphan designation; no completed Phase 3. Anti-doping status is unresolved: not named on the WADA 2026 List, but the S2.1.5 innate repair receptor agonist category is open-ended. Research use only.',
  last_reviewed_at = now(),
  updated_at = now()
where slug = 'ara-290';
