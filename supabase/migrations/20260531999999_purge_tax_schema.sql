-- Drop foreign key constraint on orders first
ALTER TABLE public.orders DROP COLUMN IF EXISTS tax_exemption_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS tax_jurisdiction;
ALTER TABLE public.orders DROP COLUMN IF EXISTS tax_amount;

-- Drop tax tables
DROP TABLE IF EXISTS public.tax_exemptions CASCADE;
DROP TABLE IF EXISTS public.tax_rules CASCADE;
