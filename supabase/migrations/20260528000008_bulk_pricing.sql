-- ============================================
-- PEP NATION LAB — Bulk Pricing Migration
-- Migration: 20260528000008_bulk_pricing
-- ============================================

-- 1. Add Bulk Pricing to Products (Admin to Agent/Super Agent)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS admin_bulk_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS admin_bulk_threshold INTEGER DEFAULT 100;

-- 2. Add Bulk Pricing to Super Agent Pricing (Super Agent to Sub-Agent)
ALTER TABLE public.super_agent_pricing
ADD COLUMN IF NOT EXISTS bulk_baseline_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS bulk_threshold INTEGER DEFAULT 100;
