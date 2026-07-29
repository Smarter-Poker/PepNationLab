-- ============================================================
-- PEP NATION LAB — Batch 1 Restock: Mark In-Stock + Set Quantities
-- Migration: 20260729183000_restock_instock_batch1
--
-- Source: Physical inventory arrival invoice, 2026-07-29
-- Sets inventory_count for each arriving SKU.
-- Trigger trg_sync_product_stock auto-sets in_stock = TRUE
-- when inventory_count > 0.
--
-- NOTE: 2 Selank removed → 8 net | 2 SS-31 removed → 8 net
-- All items available for same-day pickup or shipping.
-- ============================================================

BEGIN;

-- ── TIRZEPATIDE ─────────────────────────────────────────────
-- Tirzepatide 10mg  (TR10) qty 30
UPDATE products SET inventory_count = 30 WHERE id = '15f4a630-d158-42e0-b9b4-4e69b22c05ad';
-- Tirzepatide 20mg  (TR20) qty 30
UPDATE products SET inventory_count = 30 WHERE id = '1d38f719-a738-4550-aa73-33ae31e6df06';

-- ── SEMAGLUTIDE ─────────────────────────────────────────────
-- Semaglutide 10mg  (SM10) qty 30
UPDATE products SET inventory_count = 30 WHERE id = 'aeedf017-3389-4ac4-b737-1e58ee6e0337';
-- Semaglutide 20mg  (SM20) qty 30
UPDATE products SET inventory_count = 30 WHERE id = 'db2e3046-fe29-406f-92a5-1d7ca45d08f3';

-- ── BPC-157 ─────────────────────────────────────────────────
-- BPC-157 10mg  (BC10) qty 30
UPDATE products SET inventory_count = 30 WHERE id = '7d77bf8d-405d-4877-84f4-da566f37a06b';

-- ── TB-500 ──────────────────────────────────────────────────
-- TB500 (Thymosin B4 Acetate) 10mg  (BT10) qty 30
UPDATE products
  SET inventory_count = 30
  WHERE (name ILIKE 'TB%500%10mg%' OR name ILIKE 'TB-500 10mg%' OR name ILIKE 'Thymosin B4%10mg%')
    AND is_active = TRUE;

-- ── RETATRUTIDE ─────────────────────────────────────────────
-- Retatrutide 10mg  (RT10) qty 20
UPDATE products SET inventory_count = 20 WHERE id = '80ab0b9f-0bda-43d9-9d51-89ae94ab17cc';
-- Retatrutide 20mg  (RT20) qty 20
UPDATE products SET inventory_count = 20 WHERE id = 'c2176b53-69da-41ed-9aa3-73c2a9a04e21';

-- ── TESAMORELIN ─────────────────────────────────────────────
-- Tesamorelin 10mg  (TSM10) qty 10
UPDATE products SET inventory_count = 10 WHERE id = '384289c1-d498-4b36-a81e-07e29aa77b34';
-- Tesamorelin 20mg  (TSM20) qty 10
UPDATE products SET inventory_count = 10 WHERE id = 'd5e8b4c6-aa2c-46e8-ad9d-a2cfb1162591';

-- ── CJC-1295 WITHOUT DAC ────────────────────────────────────
-- CJC-1295 Without DAC 10mg  (CND10) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'CJC-1295 Without DAC%10mg%'
    AND is_active = TRUE;

-- ── IPAMORELIN ──────────────────────────────────────────────
-- Ipamorelin 10mg  (IP10) qty 20
UPDATE products SET inventory_count = 20 WHERE id = '3d9d5093-ad2e-4448-8747-752aaaa8113a';

-- ── AOD-9604 ────────────────────────────────────────────────
-- AOD-9604 10mg  (10AD) qty 10
UPDATE products SET inventory_count = 10 WHERE id = 'e51fe224-d138-4f07-83bb-a4779218582e';

-- ── MOTS-C ──────────────────────────────────────────────────
-- MOTS-C 10mg  (MS10) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'MOTS%C%10mg%'
    AND is_active = TRUE;

-- ── PT-141 ──────────────────────────────────────────────────
-- PT-141 10mg  (P41) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'PT-141%10mg%'
    AND is_active = TRUE;

-- ── GHK-CU ──────────────────────────────────────────────────
-- GHK-CU 50mg  (CU) qty 30
UPDATE products
  SET inventory_count = 30
  WHERE name ILIKE 'GHK%CU%50mg%'
    AND is_active = TRUE;

-- ── THYMOSIN ALPHA-1 ────────────────────────────────────────
-- Thymosin Alpha-1 10mg  (TA10) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'Thymosin Alpha%10mg%'
    AND is_active = TRUE;

-- ── EPITHALON ───────────────────────────────────────────────
-- Epithalon 10mg  (ET10) qty 10
UPDATE products SET inventory_count = 10 WHERE id = 'ad885501-b9dd-4151-8b4c-6eab5e72db71';

-- ── DSIP ────────────────────────────────────────────────────
-- DSIP 10mg  (DS10) qty 10
UPDATE products SET inventory_count = 10 WHERE id = '84a34f6f-2676-428b-85ac-86e18dcb0da9';

-- ── KISSPEPTIN-10 ───────────────────────────────────────────
-- KissPeptin-10 10mg  (KS10) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'KissPeptin%10mg%'
    AND is_active = TRUE;

-- ── SELANK ──────────────────────────────────────────────────
-- Selank 10mg  (SK10) qty 10 ordered — MINUS 2 removed = 8 net
UPDATE products
  SET inventory_count = 8
  WHERE name ILIKE 'Selank%10mg%'
    AND is_active = TRUE;

-- ── SEMAX ───────────────────────────────────────────────────
-- Semax 10mg  (XA10) qty 10
UPDATE products SET inventory_count = 10 WHERE id = 'a6e6b0bd-fe07-4cc7-a84e-7db6c7344696';

-- ── GH SYNERGY STACK ────────────────────────────────────────
-- GH Synergy Stack (CJC 5mg + IPA 5mg)  (CP10) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE (name ILIKE 'GH Synergy%' OR name ILIKE 'CJC%IPA%' OR name ILIKE '%CJC 5mg%IPA%')
    AND is_active = TRUE;

-- ── SNAP-8 ──────────────────────────────────────────────────
-- SNAP-8 10mg  (NP810) qty 20
UPDATE products SET inventory_count = 20 WHERE id = '5f352b83-14e4-4daa-94fd-23c20b9c05a6';

-- ── MT-1 ────────────────────────────────────────────────────
-- MT-1 10mg  (MT1) qty 20
UPDATE products SET inventory_count = 20 WHERE id = '6b96acce-8c02-4aee-b27d-ce848af709eb';

-- ── KLOW STACK ──────────────────────────────────────────────
-- KLOW STACK (TB10+BPC10+GHK50+KPV10) 80mg  (K80) qty 20
UPDATE products
  SET inventory_count = 20
  WHERE name ILIKE 'KLOW%'
    AND is_active = TRUE;

-- ── GLOW STACK ──────────────────────────────────────────────
-- Glow Stack (TB10 + BPC10 + GHK50) 70mg  (BBG70) qty 20
UPDATE products
  SET inventory_count = 20
  WHERE name ILIKE 'Glow%Stack%'
    AND is_active = TRUE;

-- ── NAD+ ────────────────────────────────────────────────────
-- NAD+ 1000mg  (NJ1000) qty 20
UPDATE products
  SET inventory_count = 20
  WHERE name ILIKE 'NAD%1000mg%'
    AND is_active = TRUE;

-- ── VIP ─────────────────────────────────────────────────────
-- VIP 10mg  (VP10) qty 10
UPDATE products SET inventory_count = 10 WHERE id = '55c0d491-46e1-4a0b-a1fd-b6c1aecc8919';

-- ── CAGRILINTIDE ────────────────────────────────────────────
-- Cagrilintide 10mg  (CGL10) qty 10
UPDATE products SET inventory_count = 10 WHERE id = 'b192cfa3-ec81-460d-9bf2-97ef16c2b54f';

-- ── L-CARNITINE ─────────────────────────────────────────────
-- L-Carnitine 600mg  (LC600) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'L%Carnitine%600mg%'
    AND is_active = TRUE;

-- ── HGH FRAGMENT 176-191 ────────────────────────────────────
-- HGH Fragment 176-191 5mg  (FR5) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE (name ILIKE 'HGH Fragment%5mg%' OR name ILIKE 'HGH Frag%176%5mg%')
    AND is_active = TRUE;

-- ── LL-37 ───────────────────────────────────────────────────
-- LL-37 5mg  (375) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'LL%37%5mg%'
    AND is_active = TRUE;

-- ── KPV ─────────────────────────────────────────────────────
-- KPV 10mg  (KP10) qty 10
UPDATE products SET inventory_count = 10 WHERE id = 'f51f5cd5-4c04-4d7d-87f2-275053c319fe';

-- ── OXYTOCIN ────────────────────────────────────────────────
-- Oxytocin 10mg  (OT10) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'Oxytocin%10mg%'
    AND is_active = TRUE;

-- ── FOXO4-DRI ───────────────────────────────────────────────
-- FOXO4-DRI 10mg  (F410) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'FOXO4%10mg%'
    AND is_active = TRUE;

-- ── SS-31 ───────────────────────────────────────────────────
-- SS-31 10mg  (2S10) qty 10 ordered — MINUS 2 removed = 8 net
UPDATE products SET inventory_count = 8 WHERE id = 'e0a5b759-d0c7-4ce7-865b-0656d214d382';

-- ── SERMORELIN ──────────────────────────────────────────────
-- Sermorelin 10mg  (SMO10) qty 10
UPDATE products
  SET inventory_count = 10
  WHERE name ILIKE 'Sermorelin%10mg%'
    AND is_active = TRUE;

-- ── BAC WATER ───────────────────────────────────────────────
-- BAC Water 10ml  (BA10) qty 230
UPDATE products
  SET inventory_count = 230
  WHERE name ILIKE 'BAC%Water%'
    AND is_active = TRUE;

COMMIT;
