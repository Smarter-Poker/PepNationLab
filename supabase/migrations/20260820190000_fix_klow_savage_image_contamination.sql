-- Repair the KLOW STACK backfill that leaked Savage Brands art into Pep Nation
-- storefronts.
--
-- On 2026-08-19 a backfill intended for "all 39 Savage Brands agent_products
-- rows" was not scoped to the Savage network. It wrote
-- /images/savage-brands/klow-stack-80mg.jpg onto the KLOW STACK row of ~48
-- storefronts that are NOT in the Savage network.
--
-- Each of those stores then had exactly 1 savage-path row out of ~114. The
-- storefront grid classified a store as Savage if ANY row carried a savage
-- path, so one row misbranded the entire storefront. getProductImage() then
-- took its Savage branch for every OTHER product -- whose image resolves to
-- /images/products/*.png, not a savage path -- and returned the generic clear
-- vial. Result: every vial on the product detail view (hero, Supplies You
-- Need, What's Inside This Stack, Similar Products) rendered as a blank vial.
-- The catalog grid hid the damage because it paints a pre-composited card
-- JPEG and never renders the vial layer.
--
-- Setting custom_image_url back to NULL makes these rows fall through to
-- products.image_url = /images/products/klow-tb10-bpc10-ghk50-kpv10-k80.png,
-- which is the correct Pep Nation KLOW art.
--
-- Scoped with a recursive walk of profiles.parent_agent_id so that genuine
-- Savage downlines (eddierazz, kathy, nick, todd, ...) KEEP their savage art.
-- See the follow-up migration 20260820190500 for nine Savage stores whose
-- parent chain is broken and which this scoping got wrong.

with recursive savage_net as (
  select id from agent_profiles where slug = 'savagebrands'
  union
  select pr.id
  from profiles pr
  join savage_net sn on pr.parent_agent_id = sn.id
)
update agent_products ap
set custom_image_url = null
where ap.custom_image_url = '/images/savage-brands/klow-stack-80mg.jpg'
  and ap.agent_id not in (select id from savage_net);
