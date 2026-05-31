-- Drop the trigger that auto-creates legacy agent_commissions rows.
-- PepNationLab uses a wholesale margin arbitrage model (unit_cost_price - unit_super_agent_cost),
-- not a flat percentage commission payout from the Admin.
DROP TRIGGER IF EXISTS trg_create_commission_on_approval ON public.orders;
DROP FUNCTION IF EXISTS public.fn_create_commission_on_approval();

-- Drop the agent_commissions table entirely to prevent further confusion.
DROP TABLE IF EXISTS public.agent_commissions CASCADE;
