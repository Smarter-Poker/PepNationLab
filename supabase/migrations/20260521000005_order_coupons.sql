-- ============================================
-- PEP NATION LAB - Order Coupon Support
-- Migration: 20260521000005_order_coupons
-- ============================================
-- Adds coupon tracking to the orders table so that a redeemed coupon
-- code and the resulting discount are recorded on each order. The
-- coupons table itself already exists from the initial schema.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
