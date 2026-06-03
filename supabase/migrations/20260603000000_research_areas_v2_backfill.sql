-- ============================================================================
-- 20260603000000_research_areas_v2_backfill.sql
-- ----------------------------------------------------------------------------
-- Research Library v2 — Phase A data layer.
-- Adds 4 new research-area tags to every relevant compound so the new
-- /research/area/[area] landing pages return populated grids:
--
--   weight_management   — GLP-1 / GIP / triple-agonist incretins + lipolytic GH fragments + 5-amino-1MQ + MOTS-c + lipotropic blends
--   gut_health          — Mucosal repair, tight-junction integrity, GI cytoprotection (BPC-157, KPV, VIP, LL-37, Thymosin alpha-1)
--   pain_inflammation   — Cross-class anti-inflammatory / analgesic mechanisms (BPC-157, TB-500, LL-37, KPV, ARA-290, Thymosin alpha-1)
--   bone_joint          — Bone density, cartilage, joint repair (BPC-157, TB-500, GHK-Cu, AHK-Cu, IGF-1, GHRH/GHS stack pathways)
--
-- The migration is fully idempotent — research_areas is text[] and we use
-- array_append guarded by a NOT array-contains check, so re-runs are no-ops.
-- ============================================================================

BEGIN;

-- weight_management
UPDATE compounds SET research_areas = array_append(research_areas, 'weight_management')
  WHERE slug IN (
    'semaglutide','tirzepatide','retatrutide','survodutide','cagrilintide','cagrisema',
    'aod9604','tesamorelin','hgh-frag-176-191','mots-c','5-amino-1mq',
    'lemon-bottle','lipo-c'
  ) AND NOT ('weight_management' = ANY(research_areas));

-- gut_health
UPDATE compounds SET research_areas = array_append(research_areas, 'gut_health')
  WHERE slug IN (
    'bpc-157','kpv','vip','ll-37','thymosin-alpha-1'
  ) AND NOT ('gut_health' = ANY(research_areas));

-- pain_inflammation
UPDATE compounds SET research_areas = array_append(research_areas, 'pain_inflammation')
  WHERE slug IN (
    'bpc-157','tb-500','ll-37','kpv','ara-290','thymosin-alpha-1'
  ) AND NOT ('pain_inflammation' = ANY(research_areas));

-- bone_joint
UPDATE compounds SET research_areas = array_append(research_areas, 'bone_joint')
  WHERE slug IN (
    'bpc-157','tb-500','ghk-cu','ahk-cu','igf-1-lr3',
    'cjc-1295-no-dac','cjc-1295-dac','ipamorelin','cjc-ipa-stack','sermorelin','tesamorelin'
  ) AND NOT ('bone_joint' = ANY(research_areas));

COMMIT;
