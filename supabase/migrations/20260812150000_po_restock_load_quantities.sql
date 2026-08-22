-- ============================================================
-- PO Restock: Load purchase order quantities into inventory_count
-- Date: 2026-08-12
-- Source: Purchase Order — 600 peptide vials + 230 BAC Water
-- 
-- Strategy: UPDATE inventory_count using name + unit_size match.
-- The sync trigger (trg_sync_product_stock) will automatically
-- set in_stock = TRUE when inventory_count > 0.
-- 
-- When a product's inventory_count > low_stock_threshold, the
-- storefront will show the "In Stock (Same-Day Pickup)" banner.
-- When inventory_count drops to 0, it falls back to backorder
-- (backorder_days = 3 set by the previous migration).
-- ============================================================

-- Helper function: update a single product variant by name + unit_size
-- and log how many were matched.

DO $$
DECLARE
  rows_affected INT;
BEGIN

  -- Tirzepatide 10mg x30
  UPDATE products SET inventory_count = inventory_count + 30
  WHERE LOWER(name) = 'tirzepatide' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Tirzepatide 10mg: % row(s) updated', rows_affected;

  -- Tirzepatide 20mg x30
  UPDATE products SET inventory_count = inventory_count + 30
  WHERE LOWER(name) = 'tirzepatide' AND (unit_size = '20' OR unit_size = '20mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Tirzepatide 20mg: % row(s) updated', rows_affected;

  -- Semaglutide 10mg x30
  UPDATE products SET inventory_count = inventory_count + 30
  WHERE LOWER(name) = 'semaglutide' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Semaglutide 10mg: % row(s) updated', rows_affected;

  -- Semaglutide 20mg x30
  UPDATE products SET inventory_count = inventory_count + 30
  WHERE LOWER(name) = 'semaglutide' AND (unit_size = '20' OR unit_size = '20mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Semaglutide 20mg: % row(s) updated', rows_affected;

  -- BPC 157 10mg x30
  UPDATE products SET inventory_count = inventory_count + 30
  WHERE LOWER(name) IN ('bpc 157', 'bpc-157') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'BPC 157 10mg: % row(s) updated', rows_affected;

  -- TB500 / Thymosin B4 Acetate 10mg x30
  UPDATE products SET inventory_count = inventory_count + 30
  WHERE LOWER(name) IN ('tb500', 'tb-500', 'thymosin b4 acetate') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'TB500 10mg: % row(s) updated', rows_affected;

  -- Retatrutide 10mg x20
  UPDATE products SET inventory_count = inventory_count + 20
  WHERE LOWER(name) = 'retatrutide' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Retatrutide 10mg: % row(s) updated', rows_affected;

  -- Retatrutide 20mg x20
  UPDATE products SET inventory_count = inventory_count + 20
  WHERE LOWER(name) = 'retatrutide' AND (unit_size = '20' OR unit_size = '20mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Retatrutide 20mg: % row(s) updated', rows_affected;

  -- Tesamorelin 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'tesamorelin' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Tesamorelin 10mg: % row(s) updated', rows_affected;

  -- Tesamorelin 20mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'tesamorelin' AND (unit_size = '20' OR unit_size = '20mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Tesamorelin 20mg: % row(s) updated', rows_affected;

  -- CJC-1295 Without DAC 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('cjc-1295 without dac', 'cjc 1295 without dac') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'CJC-1295 Without DAC 10mg: % row(s) updated', rows_affected;

  -- Ipamorelin 10mg x20
  UPDATE products SET inventory_count = inventory_count + 20
  WHERE LOWER(name) = 'ipamorelin' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Ipamorelin 10mg: % row(s) updated', rows_affected;

  -- AOD9604 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('aod9604', 'aod 9604') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'AOD9604 10mg: % row(s) updated', rows_affected;

  -- MOTS-C 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'mots-c' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'MOTS-C 10mg: % row(s) updated', rows_affected;

  -- PT-141 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('pt-141', 'pt141') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'PT-141 10mg: % row(s) updated', rows_affected;

  -- GHK-Cu 50mg x30
  UPDATE products SET inventory_count = inventory_count + 30
  WHERE LOWER(name) IN ('ghk-cu', 'ghk cu') AND (unit_size = '50' OR unit_size = '50mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'GHK-Cu 50mg: % row(s) updated', rows_affected;

  -- Thymosin Alpha-1 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('thymosin alpha-1', 'thymosin alpha 1') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Thymosin Alpha-1 10mg: % row(s) updated', rows_affected;

  -- Epithalon 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'epithalon' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Epithalon 10mg: % row(s) updated', rows_affected;

  -- DSIP 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'dsip' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'DSIP 10mg: % row(s) updated', rows_affected;

  -- KissPeptin-10 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('kisspeptin-10', 'kisspeptin 10') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'KissPeptin-10 10mg: % row(s) updated', rows_affected;

  -- Selank 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'selank' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Selank 10mg: % row(s) updated', rows_affected;

  -- Semax 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'semax' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Semax 10mg: % row(s) updated', rows_affected;

  -- GH Synergy Stack (CJC 5mg + IPA 5mg) 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('gh synergy stack', 'gh synergy stack (cjc 5mg + ipa 5mg)') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'GH Synergy Stack 10mg: % row(s) updated', rows_affected;

  -- SNAP-8 10mg x20
  UPDATE products SET inventory_count = inventory_count + 20
  WHERE LOWER(name) IN ('snap-8', 'snap8') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'SNAP-8 10mg: % row(s) updated', rows_affected;

  -- MT-1 10mg x20
  UPDATE products SET inventory_count = inventory_count + 20
  WHERE LOWER(name) IN ('mt-1', 'mt1') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'MT-1 10mg: % row(s) updated', rows_affected;

  -- KLOW Stack 80mg x20
  UPDATE products SET inventory_count = inventory_count + 20
  WHERE LOWER(name) IN ('klow stack', 'klow') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'KLOW Stack 80mg: % row(s) updated', rows_affected;

  -- Glow Stack 70mg x20
  UPDATE products SET inventory_count = inventory_count + 20
  WHERE LOWER(name) IN ('glow stack', 'glow') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Glow Stack 70mg: % row(s) updated', rows_affected;

  -- NAD+ 1000mg x20
  UPDATE products SET inventory_count = inventory_count + 20
  WHERE LOWER(name) IN ('nad+', 'nad') AND (unit_size = '1000' OR unit_size = '1000mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'NAD+ 1000mg: % row(s) updated', rows_affected;

  -- VIP 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'vip' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'VIP 10mg: % row(s) updated', rows_affected;

  -- Cagrilintide 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'cagrilintide' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Cagrilintide 10mg: % row(s) updated', rows_affected;

  -- L-Carnitine 600mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('l-carnitine', 'l carnitine') AND (unit_size = '600' OR unit_size = '600mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'L-Carnitine 600mg: % row(s) updated', rows_affected;

  -- HGH Fragment 176-191 5mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('hgh fragment 176-191', 'hgh fragment') AND (unit_size = '5' OR unit_size = '5mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'HGH Fragment 176-191 5mg: % row(s) updated', rows_affected;

  -- LL-37 5mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('ll-37', 'll37') AND (unit_size = '5' OR unit_size = '5mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'LL-37 5mg: % row(s) updated', rows_affected;

  -- KPV 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'kpv' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'KPV 10mg: % row(s) updated', rows_affected;

  -- Oxytocin 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'oxytocin' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Oxytocin 10mg: % row(s) updated', rows_affected;

  -- FOXO4-DRI 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('foxo4-dri', 'foxo4 dri') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'FOXO4-DRI 10mg: % row(s) updated', rows_affected;

  -- SS-31 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) IN ('ss-31', 'ss31') AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'SS-31 10mg: % row(s) updated', rows_affected;

  -- Sermorelin 10mg x10
  UPDATE products SET inventory_count = inventory_count + 10
  WHERE LOWER(name) = 'sermorelin' AND (unit_size = '10' OR unit_size = '10mg') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'Sermorelin 10mg: % row(s) updated', rows_affected;

  -- BAC Water 10ml x230
  UPDATE products SET inventory_count = inventory_count + 230
  WHERE LOWER(name) IN ('bac water', 'bacteriostatic water') AND (unit_size = '10' OR unit_size = '10ml') AND is_active = TRUE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RAISE NOTICE 'BAC Water 10ml: % row(s) updated', rows_affected;

  RAISE NOTICE '=== PO Restock complete: 600 peptide vials + 230 BAC Water vials loaded ===';

END $$;
