-- Migration: 20260608000033_deactivate_removed_products.sql
-- Description: Deactivate products that were removed/deleted by the admin but remained active in the database with 0 inventory.

UPDATE public.products
SET is_active = false
WHERE id IN (
  '774d0792-8c16-4b27-b914-8907db68c70f', -- Limitless Stack (Semax + Selank)
  '851f2ad7-5838-40ac-9c36-c875bd5a4a51', -- Shred Stack (Tirzepatide + AOD9604)
  '7ecae016-c3cb-4bad-914a-1f887c2aff2d'  -- Tirzepatide (TR50)
);
