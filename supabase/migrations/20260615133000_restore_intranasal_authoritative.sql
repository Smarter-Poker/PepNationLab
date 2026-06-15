-- Restore the authoritative intranasal classification.
--
-- WHY: migration 20260614182000_add_intranasal_columns_to_compounds.sql is a
-- DUPLICATE of 20260614120000_compound_intranasal.sql. It ran AFTER 120000 and
-- overwrote several rows with thinner / less accurate values -- most importantly
-- it downgraded selank and semax (registered nasal-drop peptides) from
-- established to emerging, wiped selank's 93 percent bioavailability, and stamped
-- oxytocin with a dubious 65 percent figure. This migration re-asserts the
-- researched, authoritative classification so every environment converges to the
-- correct state regardless of migration order. Idempotent (UPDATE by slug).
--
-- 120000 remains the original source of these values; this file simply wins last.

-- ESTABLISHED: approved/registered nasal products or solid human clinical use.
UPDATE compounds SET intranasal_status = 'established' WHERE slug IN (
  'selank','semax','b12','oxytocin','melatonin','glutathione',
  'ghrp-2','ghrp-6','hexarelin','pt-141','limitless-stack'
);

-- EMERGING: real published intranasal research, not yet a standard route.
UPDATE compounds SET intranasal_status = 'emerging' WHERE slug IN (
  'dsip','vip','cerebrolysin','ll-37','kisspeptin-10','mt-1','ipamorelin',
  'sermorelin','igf-1-lr3','bpc-157','kpv','epithalon','pinealon','thymalin',
  'nad-plus','aod9604','mots-c'
);

-- Nasal bioavailability where a defensible figure exists; explicitly clear the
-- values the duplicate migration invented (oxytocin) or wiped (selank).
UPDATE compounds SET intranasal_bioavailability_pct = 93   WHERE slug = 'selank';
UPDATE compounds SET intranasal_bioavailability_pct = 94   WHERE slug = 'melatonin';
UPDATE compounds SET intranasal_bioavailability_pct = 20   WHERE slug = 'ipamorelin';
UPDATE compounds SET intranasal_bioavailability_pct = 4    WHERE slug = 'sermorelin';
UPDATE compounds SET intranasal_bioavailability_pct = 6    WHERE slug = 'ghrp-2';
UPDATE compounds SET intranasal_bioavailability_pct = NULL WHERE slug = 'oxytocin';
UPDATE compounds SET intranasal_bioavailability_pct = NULL WHERE slug = 'semax';

-- Authoritative per-compound notes (no apostrophes, to keep the SQL simple).
UPDATE compounds SET intranasal_note = 'Registered as nasal drops; nasal is the native route (about 93 percent bioavailability).' WHERE slug = 'selank';
UPDATE compounds SET intranasal_note = 'Registered nasal drops with documented human clinical use.' WHERE slug = 'semax';
UPDATE compounds SET intranasal_note = 'An FDA-approved cobalamin nasal spray (Nascobal) exists.' WHERE slug = 'b12';
UPDATE compounds SET intranasal_note = 'Intranasal is the standard route across human oxytocin research.' WHERE slug = 'oxytocin';
UPDATE compounds SET intranasal_note = 'Human pharmacokinetics show rapid onset and high nasal bioavailability.' WHERE slug = 'melatonin';
UPDATE compounds SET intranasal_note = 'Completed human intranasal trials with confirmed brain uptake.' WHERE slug = 'glutathione';
UPDATE compounds SET intranasal_note = 'Human intranasal growth-hormone-release studies are documented.' WHERE slug = 'ghrp-2';
UPDATE compounds SET intranasal_note = 'Documented intranasal growth-hormone release in humans.' WHERE slug = 'ghrp-6';
UPDATE compounds SET intranasal_note = 'The best-documented nasal growth-hormone peptide, with multi-month human nasal trials.' WHERE slug = 'hexarelin';
UPDATE compounds SET intranasal_note = 'Originally developed as an intranasal product; later moved to injection for blood-pressure safety.' WHERE slug = 'pt-141';
UPDATE compounds SET intranasal_note = 'Both components (Semax and Selank) are established intranasal peptides.' WHERE slug = 'limitless-stack';

UPDATE compounds SET intranasal_note = 'A small peptide with animal intranasal research; not yet a standard human route.' WHERE slug = 'dsip';
UPDATE compounds SET intranasal_note = 'Animal nose-to-brain studies show delivery; the inhaled and IV COVID trials were a different route.' WHERE slug = 'vip';
UPDATE compounds SET intranasal_note = 'A low-molecular-weight peptide mixture with peer-reviewed animal intranasal studies; clinically still injectable.' WHERE slug = 'cerebrolysin';
UPDATE compounds SET intranasal_note = 'Used intranasally in research, but caused nasal-lining irritation in animal studies.' WHERE slug = 'll-37';
UPDATE compounds SET intranasal_note = 'Human nasal data exists, mostly on the larger kisspeptin-54 analog.' WHERE slug = 'kisspeptin-10';
UPDATE compounds SET intranasal_note = 'Nasal absorption is plausible and gray-market sprays are sold, but no approved nasal product exists and safety cautions apply.' WHERE slug = 'mt-1';
UPDATE compounds SET intranasal_note = 'The best measured nasal bioavailability of the growth-hormone peptides (about 20 percent), but evidence is pharmacokinetic only.' WHERE slug = 'ipamorelin';
UPDATE compounds SET intranasal_note = 'Human intranasal studies exist but nasal bioavailability is low (about 3 to 5 percent).' WHERE slug = 'sermorelin';
UPDATE compounds SET intranasal_note = 'Intranasal research is nose-to-brain (central nervous system) in animals only; not a systemic substitute for injection.' WHERE slug = 'igf-1-lr3';
UPDATE compounds SET intranasal_note = 'Widely sold as a nasal spray; evidence is animal and anecdotal, with no human nasal trials.' WHERE slug = 'bpc-157';
UPDATE compounds SET intranasal_note = 'A tiny tripeptide with a strong rationale for local nasal anti-inflammatory use; no human nasal trials.' WHERE slug = 'kpv';
UPDATE compounds SET intranasal_note = 'A tiny tetrapeptide with published animal intranasal data; no human nasal trials.' WHERE slug = 'epithalon';
UPDATE compounds SET intranasal_note = 'A tiny tripeptide with rodent intranasal data; preclinical only.' WHERE slug = 'pinealon';
UPDATE compounds SET intranasal_note = 'Russian clinical reports describe intranasal use; no independent Western trials.' WHERE slug = 'thymalin';
UPDATE compounds SET intranasal_note = 'Sold as a nasal spray; only animal neuroprotection data, with no human nasal trials.' WHERE slug = 'nad-plus';
UPDATE compounds SET intranasal_note = 'Small enough that nasal absorption is plausible, but there is no preclinical or clinical nasal data.' WHERE slug = 'aod9604';
UPDATE compounds SET intranasal_note = 'Nose-to-brain research exists but required a cell-penetrating carrier, not the peptide alone.' WHERE slug = 'mots-c';

-- Keep route_of_admin in sync: every established/emerging compound is bucketed
-- under Intranasal on the Browse-By-Route page.
UPDATE compounds
SET route_of_admin = (
  SELECT array_agg(DISTINCT r)
  FROM unnest(coalesce(route_of_admin, '{}') || ARRAY['intranasal']) AS r
)
WHERE intranasal_status IN ('established','emerging')
  AND NOT ('intranasal' = ANY(coalesce(route_of_admin, '{}')));
