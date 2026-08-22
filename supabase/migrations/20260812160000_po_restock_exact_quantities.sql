-- ============================================================
-- PO Restock: RESET inventory_count to exact PO quantities
-- Date: 2026-08-12
-- 
-- This migration replaces the additive load from 20260812150000.
-- It SETS inventory_count to the exact PO quantity for each
-- product, then deducts:
--   • Last 2 orders (Aug 10 pending + July 26 approved)
--   • Manual adjustments: -2 Selank, -2 Semax, -1 SS-31
-- 
-- Items in the two orders that are DIFFERENT sizes from the PO
-- are NOT deducted (they don't come from this PO stock):
--   - Oxytocin Acetate 5mg  (PO has 10mg only)
--   - KissPeptin-10 5mg     (PO has 10mg only)
--   - GHK-CU 100mg          (PO has 50mg only)
--   - AHK-CU 100mg          (not on PO at all)
--   - MOTS-C 40mg           (PO has 10mg only)
-- ============================================================

-- ── STEP 1: SET to exact PO quantities ──────────────────────

-- Tirzepatide 10mg = 30
UPDATE products SET inventory_count = 30
WHERE LOWER(name) = 'tirzepatide' AND unit_size = '10' AND is_active = TRUE;

-- Tirzepatide 20mg = 30
UPDATE products SET inventory_count = 30
WHERE LOWER(name) = 'tirzepatide' AND unit_size = '20' AND is_active = TRUE;

-- Semaglutide 10mg = 30
UPDATE products SET inventory_count = 30
WHERE LOWER(name) = 'semaglutide' AND unit_size = '10' AND is_active = TRUE;

-- Semaglutide 20mg = 30
UPDATE products SET inventory_count = 30
WHERE LOWER(name) = 'semaglutide' AND unit_size = '20' AND is_active = TRUE;

-- BPC 157 10mg = 30
UPDATE products SET inventory_count = 30
WHERE LOWER(name) IN ('bpc 157', 'bpc-157') AND unit_size = '10' AND is_active = TRUE;

-- TB500 10mg = 30  →  minus 1 (July 26 order) = 29
UPDATE products SET inventory_count = 29
WHERE LOWER(name) IN ('tb500', 'tb-500', 'thymosin b4 acetate') AND unit_size = '10' AND is_active = TRUE;

-- Retatrutide 10mg = 20  →  minus 1 (July 26) minus 1 (Aug 10) = 18
UPDATE products SET inventory_count = 18
WHERE LOWER(name) = 'retatrutide' AND unit_size = '10' AND is_active = TRUE;

-- Retatrutide 20mg = 20  →  minus 1 (Aug 10) = 19
UPDATE products SET inventory_count = 19
WHERE LOWER(name) = 'retatrutide' AND unit_size = '20' AND is_active = TRUE;

-- Tesamorelin 10mg = 10  →  minus 1 (July 26) = 9
UPDATE products SET inventory_count = 9
WHERE LOWER(name) = 'tesamorelin' AND unit_size = '10' AND is_active = TRUE;

-- Tesamorelin 20mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) = 'tesamorelin' AND unit_size = '20' AND is_active = TRUE;

-- CJC-1295 Without DAC 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('cjc-1295 without dac', 'cjc 1295 without dac') AND unit_size = '10' AND is_active = TRUE;

-- Ipamorelin 10mg = 20
UPDATE products SET inventory_count = 20
WHERE LOWER(name) = 'ipamorelin' AND unit_size = '10' AND is_active = TRUE;

-- AOD9604 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('aod9604', 'aod 9604') AND unit_size = '10' AND is_active = TRUE;

-- MOTS-C 10mg = 10  (Aug 10 order was 40mg — not deducted from PO 10mg stock)
UPDATE products SET inventory_count = 10
WHERE LOWER(name) = 'mots-c' AND unit_size = '10' AND is_active = TRUE;

-- PT-141 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('pt-141', 'pt141') AND unit_size = '10' AND is_active = TRUE;

-- GHK-CU 50mg = 30  (July 26 order was 100mg — different size, not deducted)
UPDATE products SET inventory_count = 30
WHERE LOWER(name) IN ('ghk-cu', 'ghk cu') AND unit_size = '50' AND is_active = TRUE;

-- Thymosin Alpha-1 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('thymosin alpha-1', 'thymosin alpha 1') AND unit_size = '10' AND is_active = TRUE;

-- Epithalon 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) = 'epithalon' AND unit_size = '10' AND is_active = TRUE;

-- DSIP 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) = 'dsip' AND unit_size = '10' AND is_active = TRUE;

-- KissPeptin-10 10mg = 10  (July 26 order was 5mg — different size, not deducted)
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('kisspeptin-10', 'kisspeptin 10') AND unit_size = '10' AND is_active = TRUE;

-- Selank 10mg = 10  →  minus 2 (manual adjustment) = 8
UPDATE products SET inventory_count = 8
WHERE LOWER(name) = 'selank' AND unit_size = '10' AND is_active = TRUE;

-- Semax 10mg = 10  →  minus 2 (manual adjustment) = 8
UPDATE products SET inventory_count = 8
WHERE LOWER(name) = 'semax' AND unit_size = '10' AND is_active = TRUE;

-- GH Synergy Stack 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('gh synergy stack', 'gh synergy stack (cjc 5mg + ipa 5mg)') AND is_active = TRUE;

-- SNAP-8 10mg = 20
UPDATE products SET inventory_count = 20
WHERE LOWER(name) IN ('snap-8', 'snap8') AND unit_size = '10' AND is_active = TRUE;

-- MT-1 10mg = 20
UPDATE products SET inventory_count = 20
WHERE LOWER(name) IN ('mt-1', 'mt1') AND unit_size = '10' AND is_active = TRUE;

-- KLOW STACK 80mg = 20
UPDATE products SET inventory_count = 20
WHERE LOWER(name) IN ('klow stack', 'klow') AND is_active = TRUE;

-- Glow Stack 70mg = 20
UPDATE products SET inventory_count = 20
WHERE LOWER(name) IN ('glow stack') AND is_active = TRUE;

-- NAD+ 1000mg = 20
UPDATE products SET inventory_count = 20
WHERE LOWER(name) IN ('nad+', 'nad') AND unit_size = '1000' AND is_active = TRUE;

-- VIP 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) = 'vip' AND unit_size = '10' AND is_active = TRUE;

-- Cagrilintide 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) = 'cagrilintide' AND unit_size = '10' AND is_active = TRUE;

-- L-Carnitine 600mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('l-carnitine', 'l carnitine') AND unit_size = '600' AND is_active = TRUE;

-- HGH Fragment 176-191 5mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('hgh fragment 176-191', 'hgh fragment') AND unit_size = '5' AND is_active = TRUE;

-- LL-37 5mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('ll-37', 'll37') AND unit_size = '5' AND is_active = TRUE;

-- KPV 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) = 'kpv' AND unit_size = '10' AND is_active = TRUE;

-- Oxytocin 10mg = 10  (July 26 order was Oxytocin Acetate 5mg — different product/size)
UPDATE products SET inventory_count = 10
WHERE LOWER(name) = 'oxytocin' AND unit_size = '10' AND is_active = TRUE;

-- FOXO4-DRI 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) IN ('foxo4-dri', 'foxo4 dri') AND unit_size = '10' AND is_active = TRUE;

-- SS-31 10mg = 10  →  minus 1 (manual adjustment) = 9
UPDATE products SET inventory_count = 9
WHERE LOWER(name) IN ('ss-31', 'ss31') AND unit_size = '10' AND is_active = TRUE;

-- Sermorelin 10mg = 10
UPDATE products SET inventory_count = 10
WHERE LOWER(name) = 'sermorelin' AND unit_size = '10' AND is_active = TRUE;

-- BAC Water 10ml = 230  →  minus 2 (July 26 order) = 228
UPDATE products SET inventory_count = 228
WHERE LOWER(name) LIKE '%bac water%' AND unit_size = '10' AND is_active = TRUE;

-- ── Confirm BAC Water 3ml stays at 0 ─────────────────────────
UPDATE products SET inventory_count = 0
WHERE LOWER(name) LIKE '%bac water%' AND unit_size = '3' AND is_active = TRUE;
