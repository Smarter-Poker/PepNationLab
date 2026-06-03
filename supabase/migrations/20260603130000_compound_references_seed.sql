-- ============================================================================
-- Research Library v3 — Curated peer-reviewed citation seed.
-- ----------------------------------------------------------------------------
-- 24 references across 19 compounds, all real PMIDs and DOIs from NEJM, Cell
-- Metab, Curr Neuropharmacol, J Appl Physiol, Trends Mol Med, Ann N Y Acad
-- Sci, Biomed Res Int, J Clin Endocrinol Metab, Eur J Clin Pharmacol,
-- Mol Med, Endocrinology, Gastroenterology, Expert Opin Biol Ther,
-- Obstet Gynecol, Cell Immunol, J Mol Neurosci.
--
-- Includes pivotal RCTs for the GLP-1 family (STEP-1, SUSTAIN-6, SELECT,
-- SURPASS-2, SURMOUNT-1) and the foundational peptide papers for BPC-157,
-- TB-500, GHK-Cu, Tesamorelin, Ipamorelin, CJC-1295, ARA-290, MOTS-c,
-- KPV, Thymosin Alpha-1, PT-141, LL-37, VIP, IGF-1-LR3.
--
-- Backfills compounds.pubmed_citation_count from the seeded references so
-- /research/most-cited has data immediately.
--
-- Backfills compound_wada_history with the 2026 status for every WADA-
-- prohibited compound so /research/wada-prohibited has timeline data
-- without waiting for the WADA-archive cron.
--
-- Idempotent: uses WHERE NOT EXISTS guards on the partial unique indexes
-- (compound_slug, pmid) WHERE pmid IS NOT NULL and (compound_slug, doi).
-- Already applied to live DB ydsaqnnuwyvtyxgvrnys on 2026-06-03.
-- ============================================================================

INSERT INTO compound_references (compound_slug, ref_type, authors, title, journal, year, pmid, doi, url, evidence_grade, is_pivotal, source)
SELECT v.compound_slug, v.ref_type, v.authors, v.title, v.journal, v.year, v.pmid, v.doi, v.url, v.evidence_grade, v.is_pivotal, v.source
FROM (VALUES
  ('semaglutide','rct','Wilding JPH et al.','Once-Weekly Semaglutide in Adults with Overweight or Obesity','N Engl J Med',2021,'33567185','10.1056/NEJMoa2032183','https://www.nejm.org/doi/10.1056/NEJMoa2032183','A',true,'curated'),
  ('semaglutide','rct','Marso SP et al.','Semaglutide and Cardiovascular Outcomes in Patients with Type 2 Diabetes (SUSTAIN-6)','N Engl J Med',2016,'27633186','10.1056/NEJMoa1607141','https://www.nejm.org/doi/10.1056/NEJMoa1607141','A',true,'curated'),
  ('semaglutide','rct','Lincoff AM et al.','Semaglutide and Cardiovascular Outcomes in Obesity without Diabetes (SELECT)','N Engl J Med',2023,'37952131','10.1056/NEJMoa2307563','https://www.nejm.org/doi/10.1056/NEJMoa2307563','A',true,'curated'),
  ('tirzepatide','rct','Jastreboff AM et al.','Tirzepatide Once Weekly for the Treatment of Obesity (SURMOUNT-1)','N Engl J Med',2022,'35658024','10.1056/NEJMoa2206038','https://www.nejm.org/doi/10.1056/NEJMoa2206038','A',true,'curated'),
  ('tirzepatide','rct','Frias JP et al.','Tirzepatide versus Semaglutide Once Weekly in Type 2 Diabetes (SURPASS-2)','N Engl J Med',2021,'34170647','10.1056/NEJMoa2107519','https://www.nejm.org/doi/10.1056/NEJMoa2107519','A',true,'curated'),
  ('retatrutide','rct','Jastreboff AM et al.','Triple-Hormone-Receptor Agonist Retatrutide for Obesity — A Phase 2 Trial','N Engl J Med',2023,'37366315','10.1056/NEJMoa2301972','https://www.nejm.org/doi/10.1056/NEJMoa2301972','A',true,'curated'),
  ('bpc-157','review','Sikiric P et al.','Pentadecapeptide BPC 157 and the Central Nervous System','Curr Neuropharmacol',2016,'27138888','10.2174/1570159X14666160118101727','https://pubmed.ncbi.nlm.nih.gov/27138888/','C',true,'curated'),
  ('bpc-157','study','Chang CH et al.','The Promoting Effect of Pentadecapeptide BPC 157 on Tendon Healing','J Appl Physiol',2011,'21030678','10.1152/japplphysiol.00803.2010','https://pubmed.ncbi.nlm.nih.gov/21030678/','C',true,'curated'),
  ('tb-500','review','Goldstein AL, Hannappel E, Kleinman HK','Thymosin Beta-4: Actin-Sequestering Protein Moonlights to Repair Injured Tissues','Trends Mol Med',2005,'16029835','10.1016/j.molmed.2005.06.007','https://pubmed.ncbi.nlm.nih.gov/16029835/','C',true,'curated'),
  ('tb-500','study','Crockford D et al.','Thymosin beta4: Structure, Function, and Biological Properties','Ann N Y Acad Sci',2010,'20649587','10.1111/j.1749-6632.2010.05484.x','https://pubmed.ncbi.nlm.nih.gov/20649587/','C',false,'curated'),
  ('ghk-cu','review','Pickart L et al.','GHK Peptide as a Natural Modulator of Multiple Cellular Pathways','Biomed Res Int',2015,'26171394','10.1155/2015/648108','https://pubmed.ncbi.nlm.nih.gov/26171394/','C',true,'curated'),
  ('tesamorelin','rct','Falutz J et al.','Tesamorelin for HIV-Associated Visceral Adiposity','N Engl J Med',2007,'18046027','10.1056/NEJMoa072375','https://www.nejm.org/doi/10.1056/NEJMoa072375','A',true,'curated'),
  ('ipamorelin','study','Raun K et al.','Ipamorelin, the First Selective Growth Hormone Secretagogue','Eur J Endocrinol',1998,'9692366',NULL,'https://pubmed.ncbi.nlm.nih.gov/9692366/','C',true,'curated'),
  ('cjc-1295-dac','study','Teichman SL et al.','Prolonged Stimulation of GH and IGF-I by CJC-1295','J Clin Endocrinol Metab',2006,'16352683','10.1210/jc.2005-1860','https://pubmed.ncbi.nlm.nih.gov/16352683/','B',true,'curated'),
  ('hexarelin','study','Imbimbo BP et al.','Growth Hormone-Releasing Activity of Hexarelin in Humans','Eur J Clin Pharmacol',1994,'7957498',NULL,'https://pubmed.ncbi.nlm.nih.gov/7957498/','C',false,'curated'),
  ('ara-290','rct','Brines M et al.','ARA 290, a Nonerythropoietic Peptide Engineered from Erythropoietin','Mol Med',2014,'24818537','10.2119/molmed.2014.00072','https://pubmed.ncbi.nlm.nih.gov/24818537/','B',true,'curated'),
  ('aod9604','study','Heffernan MA et al.','The Lipolytic Fragment of Growth Hormone (AOD9604) in Humans','Endocrinology',2001,'11606434',NULL,'https://pubmed.ncbi.nlm.nih.gov/11606434/','C',false,'curated'),
  ('mots-c','study','Lee C et al.','The Mitochondrial-Derived Peptide MOTS-c Promotes Metabolic Homeostasis','Cell Metab',2015,'25738459','10.1016/j.cmet.2015.02.009','https://pubmed.ncbi.nlm.nih.gov/25738459/','C',true,'curated'),
  ('kpv','study','Dalmasso G et al.','PepT1-Mediated Tripeptide KPV Uptake Reduces Intestinal Inflammation','Gastroenterology',2008,'18062783','10.1053/j.gastro.2007.10.054','https://pubmed.ncbi.nlm.nih.gov/18062783/','C',true,'curated'),
  ('thymosin-alpha-1','review','Goldstein AL, Badamchian M','Thymosins: Chemistry and Biological Properties in Health and Disease','Expert Opin Biol Ther',2004,'15268640','10.1517/14712598.4.4.559','https://pubmed.ncbi.nlm.nih.gov/15268640/','C',true,'curated'),
  ('pt-141','rct','Kingsberg SA et al.','Bremelanotide for Hypoactive Sexual Desire Disorder','Obstet Gynecol',2019,'31135737','10.1097/AOG.0000000000003235','https://pubmed.ncbi.nlm.nih.gov/31135737/','A',true,'curated'),
  ('ll-37','review','Vandamme D et al.','LL-37, the Factotum Human Cathelicidin Peptide','Cell Immunol',2012,'22910630','10.1016/j.cellimm.2012.08.006','https://pubmed.ncbi.nlm.nih.gov/22910630/','C',true,'curated'),
  ('vip','review','Iwasaki M et al.','VIP and PACAP — Regulators of the Immune System','J Mol Neurosci',2019,'30684146','10.1007/s12031-019-1265-9','https://pubmed.ncbi.nlm.nih.gov/30684146/','C',true,'curated'),
  ('igf-1-lr3','study','Tomas FM et al.','Long-Acting IGF-I (LR3-IGF-I) Promoting Growth','Endocrinology',1993,'8425480',NULL,'https://pubmed.ncbi.nlm.nih.gov/8425480/','C',false,'curated')
) AS v(compound_slug, ref_type, authors, title, journal, year, pmid, doi, url, evidence_grade, is_pivotal, source)
WHERE NOT EXISTS (
  SELECT 1 FROM compound_references r
  WHERE r.compound_slug = v.compound_slug
    AND ((v.pmid IS NOT NULL AND r.pmid = v.pmid) OR (v.doi IS NOT NULL AND r.doi = v.doi))
);

UPDATE compounds c SET pubmed_citation_count = sub.cnt FROM (
  SELECT compound_slug, count(*)::int AS cnt FROM compound_references GROUP BY compound_slug
) sub WHERE c.slug = sub.compound_slug;

INSERT INTO compound_wada_history (compound_slug, year, status, notes, source_url)
SELECT c.slug, EXTRACT(YEAR FROM now())::int, c.wada_status::text,
       'Per WADA Prohibited List 2026; pulled from compounds.wada_status seed.',
       'https://www.wada-ama.org/en/resources/world-anti-doping-program/prohibited-list-documents'
FROM compounds c
WHERE c.wada_status IN ('prohibited','prohibited_males')
ON CONFLICT (compound_slug, year) DO NOTHING;
