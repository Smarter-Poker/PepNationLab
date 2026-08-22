-- Nine storefronts (mcbride, dolci, paigenicolette, flores, pep-it-up, naun,
-- rachel, bernal, steph) sell Savage Brands product art on ~99-100% of their
-- catalog rows but had profiles.parent_agent_id = NULL, so the recursive
-- Savage-network walk in lib/brand-network.ts (isSavageNetworkAgent)
-- classified them as Pep Nation. That made the server-rendered brand flag
-- disagree with the storefront, and left cold-loaded cart/order pages -- which
-- read the brand hint from localStorage rather than from the server -- showing
-- Pep Nation art for Savage orders.
--
-- Attaching them to the savagebrands root fixes server-side resolution
-- everywhere.
--
-- SAFETY: verified before applying that all nine have
--   0 orders ever, and
--   0 unpaid weekly_statements
-- so there is no historical billing to re-route. Their tier (tier_3) and
-- account_type (credit) are unchanged, so going-forward terms are unchanged.
--
-- DELIBERATELY NOT CHANGED:
--   * role / is_super_agent -- every existing savagebrands downline is
--     role='super_agent', but promoting these nine would grant sub-agent
--     management and aggregated financial visibility. That is a permissions
--     decision, not a brand-resolution one.
--   * referring_agent_id -- drives attribution/commission, not rendering.
--
-- KNOWN GAP (pre-existing, not introduced here): super_agent_pricing has ZERO
-- rows for savagebrands, so no sub-agent baseline costs are configured for ANY
-- Savage downline. These nine now sit in exactly the same state as their 16
-- existing peers.
--
-- Post-migration audit across all 79 storefronts:
--   server_client_mismatches = 0
--   blank_vial_rows          = 0
--   contaminated_rows        = 0
--   40 Savage stores / 39 Pep Nation stores

update profiles
set parent_agent_id = '844dca4b-6f01-4779-bc95-bfa1e0809c0c'
where id in (
  'a8d529c8-137f-4470-b708-2973f2045202', -- mcbride
  '0d549d76-fa08-42bd-b399-169961055828', -- dolci
  'c62ab1c0-6e81-4102-8880-36fd492377f1', -- paigenicolette
  'c211ddb5-9d1f-4227-8962-27e35626e26c', -- flores
  '0b6c5b29-9efb-4490-a10c-9d4297a41cd2', -- pep-it-up
  '3df428e2-19c5-481c-91e7-ba987f4b8842', -- naun
  '06ef7ef7-6567-4623-821a-8a6a10c18542', -- rachel
  '52a46d26-bcf8-43b0-9cbf-33db3d8573c3', -- bernal
  '77a94065-e5f5-4d80-a468-971d77c970af'  -- steph
)
and parent_agent_id is null;
