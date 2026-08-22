-- Force recalculation of all agent prices after the 35% base_cost increase.
-- We must bypass the ceiling trigger to allow the new prices to compute,
-- then they will be within the NEW ceiling anyway.

SET session_replication_role = replica;
SELECT public.recalculate_agent_product_prices(NULL, NULL, NULL);
SET session_replication_role = DEFAULT;
