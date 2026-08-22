-- Follow-up to 20260820190000_fix_klow_savage_image_contamination.sql.
--
-- That migration scoped "is this a Savage store" to a recursive walk of
-- profiles.parent_agent_id. Nine storefronts (mcbride, dolci, paigenicolette,
-- flores, pep-it-up, naun, rachel, bernal, steph) are genuine Savage Brands
-- stores whose parent_agent_id is NULL -- the chain to savagebrands was never
-- wired up -- so the walk classified them as Pep Nation and cleared their KLOW
-- STACK art along with the real contamination.
--
-- Those stores carry savage art on ~99% of their rows (e.g. 108 of 109), so
-- identify them by that signature rather than by the broken parent chain, and
-- put the KLOW image back.
--
-- KNOWN REMAINING ISSUE: the parent_agent_id chain for these nine stores is
-- still broken. Any server-side Savage-network check (lib/brand-network.ts
-- isSavageNetworkAgent) will keep misclassifying them as Pep Nation. They
-- render correctly today only because the client-side majority heuristic in
-- AgentStorefrontGrid catches them. Worth repairing at the source.

with savage_by_majority as (
  select ap.agent_id
  from agent_products ap
  group by ap.agent_id
  having count(*) filter (where ap.custom_image_url like '/images/savage-brands/%') * 2 > count(*)
)
update agent_products ap
set custom_image_url = '/images/savage-brands/klow-stack-80mg.jpg'
from products p
where p.id = ap.product_id
  and p.slug = 'klow-tb10-bpc10-ghk50-kpv10-k80'
  and ap.custom_image_url is null
  and ap.agent_id in (select agent_id from savage_by_majority);
