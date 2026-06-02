-- Monthly sales goal for agents (Sales & Accounting goal ring + pacing).
-- Agent self-sets via /api/agent/sales/goal; admins can read/set via the agent
-- detail route. NULL = unset (UI shows a suggested default target).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_sales_goal numeric(12,2);

COMMENT ON COLUMN public.profiles.monthly_sales_goal IS
  'Agent self-set (or admin-set) monthly revenue goal in USD. Drives the Sales & Accounting goal ring + pacing. NULL = unset (UI defaults to a suggested target).';
