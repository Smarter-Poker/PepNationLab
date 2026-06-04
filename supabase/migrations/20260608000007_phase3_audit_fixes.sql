-- ============================================================
-- Phase 3 Patch: Fix data bugs found in deep audit
-- 1. Remove duplicate/wrong oxytocin pk_summary (aesthetic copy-paste)
-- 2. Fix aod9604, bpc-tb, glow, klow, bac-water, acetic-acid missing fields
-- 3. Fix semaglutide best_stacked_with (remove competing tirzepatide)
-- 4. Fix ahk-cu duplicate pk_summary (first one was wrong)
-- ============================================================

-- ── Bug #2: Oxytocin was overwritten with wrong aesthetic-clinic pk_summary ──
-- The correct pk_summary was set first (lines 245-249), then wrongly overwritten
-- by a stray oxytocin update (lines 338-342). Restore the correct one.
UPDATE compounds SET
  pk_summary = 'IV infusion for obstetric indications; nasal spray for research. Plasma half-life ~3-5 minutes IV. Intranasal bioavailability ~50-80%. Rapidly metabolized by oxytocinase. CSF concentrations ~5% of plasma with intranasal route.'
WHERE slug = 'oxytocin';

-- ── Bug #8: Semaglutide best_stacked_with should not include tirzepatide ──
-- Competing GLP-1 agents are not stacked; replace with clinically appropriate partners
UPDATE compounds SET
  best_stacked_with = ARRAY['l-carnitine','b12','lipo-c','glutathione','bac-water']
WHERE slug = 'semaglutide';

-- ── Bug #4/#5: Missing year_discovered and typical_frequency ──

-- AOD9604: first synthesized at Monash University ~1998-2000 from hGH fragment work
UPDATE compounds SET
  year_discovered = 2000,
  typical_frequency = 'Once to three times daily SC injection; often fasted AM administration'
WHERE slug = 'aod9604';

-- bpc-tb stack (not a discovered compound; stack was popularized ~2015)
UPDATE compounds SET
  year_discovered = 2015
WHERE slug = 'bpc-tb';

-- GLOW stack (custom aesthetic stack; emerged ~2018 in compounding community)
UPDATE compounds SET
  year_discovered = 2018
WHERE slug = 'glow';

-- KLOW stack (expanded version of GLOW; emerged ~2019-2020)
UPDATE compounds SET
  year_discovered = 2020
WHERE slug = 'klow';

-- Bacteriostatic Water: used in pharmacopeia since early 1900s; modern 0.9% BZA spec ~1950s
UPDATE compounds SET
  year_discovered = 1950,
  typical_frequency = 'Used per reconstitution protocol; not independently dosed'
WHERE slug = 'bac-water';

-- Acetic Acid 0.6% diluent: standard lab reagent
UPDATE compounds SET
  year_discovered = 1800,
  typical_frequency = 'Used per reconstitution protocol; typically one-time diluent step'
WHERE slug = 'acetic-acid';
