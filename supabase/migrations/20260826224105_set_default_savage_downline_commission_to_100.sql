-- Savage Brands' downline markup lives in profiles.commission_pct (NOT in
-- super_agent_pricing, which is per-product and still empty).
--
-- Savage's own wholesale cost is already correct: profiles.custom_markup_override
-- = 0.49 on 844dca4b-..., i.e. base_cost x 1.49. Not changed here.
--
-- Seven of her downlines had commission_pct = NULL. All seven are the stores
-- reparented under savagebrands earlier today (migration 20260820191500) --
-- before that they had no parent, so no markup had ever been set on them.
-- A NULL commission_pct defaults to 50% at checkout, which is the bottom of
-- her 50-100% range; per instruction, missing markups are set to 100%.
--
-- SCOPE NOTES:
--   * Excludes profile 0c1fe8c8-511b-47db-bde8-cb7c035114be -- it is parented
--     to savagebrands but has role='researcher' and no storefront, so a
--     commission on it would be meaningless.
--   * Only touches NULL. Downlines with an explicit rate keep it, including
--     the ones outside the 50-100% band (25%, 30%, 40%, 98%, 200%) and the
--     ones explicitly set to 0% (dolci, edgardocuadrado21) -- 0 is a set
--     value, not a missing one, so it is left for review rather than assumed.
--
-- SAFETY: no trigger on public.profiles fires on commission_pct (verified
-- against pg_trigger), so this does NOT rewrite any agent_products.retail_price.
-- It changes only the wholesale cost cascade at checkout. All seven stores have
-- 0 orders ever, so no historical billing is affected.
--
-- Resulting cascade, e.g. Tirzepatide 10mg (base_cost 7.02):
--   Savage pays Pep Nation   7.02 x 1.49 = 10.46
--   downline at 100% pays    10.46 x 2.00 = 20.92
--
-- Spread after this migration (agent/super_agent downlines only):
--   100% x23, 50% x3, 0% x3, 25% x2, 40% x2, 98% x1, 30% x1, 200% x1
--   NULL x0

update profiles p
set commission_pct = 100
where p.parent_agent_id = '844dca4b-6f01-4779-bc95-bfa1e0809c0c'
  and p.commission_pct is null
  and p.role in ('agent', 'super_agent')
  and exists (select 1 from agent_profiles ap where ap.id = p.id);
