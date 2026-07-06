# Tier Pricing Cascade

> Last Updated: 2026-07-06. Companion To Migration
> `supabase/migrations/20260706120000_tier_pricing_global_alignment.sql`.

## The Model

Agent Wholesale Cost = `products.base_cost` x the agent's tier multiplier from
`pricing_tiers` (admin-configurable, current values):

| Tier | Multiplier | House Markup (`house_tiers.markup`) |
|---|---|---|
| Tier 1 (Premium) | 2.5x | 1.50 |
| Tier 2 (Pro) | 3.0x | 2.00 |
| Tier 3 (Rookie) | 3.5x | 2.50 |

Store Retail Price = Agent Cost x (1 + `agent_products.margin_percent` / 100).
Default margin is 50%.

`house_tiers.markup` always equals `pricing_tiers.multiplier - 1` for the
matching level (tier_N maps to level N). Runtime cost resolution lives in
`lib/pricing.ts` (`computeAgentCostV2`); stored retail recalculation lives in
the `recalculate_agent_product_prices` RPC.

## Auto-Propagation Chain

Any of the following admin actions automatically recompute the affected
`agent_products.retail_price` rows (preserving each row's `margin_percent`):

1. Editing a tier multiplier (`POST /api/admin/pricing-tiers`) - the route and
   the `trg_sync_house_tiers_from_pricing_tiers` trigger both sync
   `house_tiers.markup`, and the `trg_sync_retail_price_on_house_tier_change`
   trigger recomputes retail prices platform-wide.
2. Changing a product's `base_cost` or `is_banned` - the
   `trg_sync_retail_price_on_product_change` trigger recomputes that product
   across all stores.
3. Assigning an agent's tier (`PATCH /api/admin/agents/update-tier`) - the
   `trg_sync_tier_lock_on_tier_change` BEFORE trigger locks the agent to that
   level (`fixed_scale_override = true`, `locked_tier_level = N`,
   `house_tier_level = N`) and clears any stale `custom_markup_override`; the
   `trg_recalc_agent_products_on_markup_change` AFTER trigger then recomputes
   that agent's store.

## Rules

- An agent "set to" a tier ALWAYS pays base_cost x that tier's multiplier.
  Flat `custom_markup_override` values are cleared on tier assignment; a flat
  override must be re-applied deliberately via the admin Fixed Scale Override
  panel if ever wanted.
- Pricing context is the agent's OWN profile. Only true sub-agents
  (`is_sub_agent = true`) inherit their parent agent's pricing context.
- Never hardcode multipliers in code - `pricing_tiers` is the source of truth.
