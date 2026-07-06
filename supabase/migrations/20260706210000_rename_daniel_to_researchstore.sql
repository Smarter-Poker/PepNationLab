-- =============================================================================
-- Migration: Rename The House Storefront From "daniel" To "researchstore"
-- And Populate It With ALL Active Products From The Master Catalog.
-- This Is The Public-Facing Default Store That Guest Users Land On Via
-- "Continue As Guest" On The Landing Page.
-- =============================================================================

-- Step 1: Rename the slug in agent_profiles.
-- We use UPDATE so foreign key references (profiles.referring_agent_id, etc.)
-- all stay intact -- they reference the UUID, not the slug text.
UPDATE public.agent_profiles
   SET slug              = 'researchstore',
       display_name      = 'Pep Nation Research Store',
       storefront_renamed_at = now()
 WHERE slug = 'daniel';

-- Step 2: Populate the researchstore with every active master-catalog product
-- that is NOT already listed there.  We use the Tier-3 default retail price
-- (base_cost * 3.5 * 1.5 = 5.25x, i.e. 50% margin on top of tier-3 cost)
-- which is the standard entry-level pricing for a new agent store.
-- Existing rows are skipped via ON CONFLICT DO NOTHING.
INSERT INTO public.agent_products (
    agent_id,
    product_id,
    is_visible,
    retail_price,
    is_on_sale,
    sort_order
)
SELECT
    ap.id                                         AS agent_id,
    p.id                                          AS product_id,
    true                                          AS is_visible,
    -- Tier-3 cost * 1.5 margin, rounded to 2 dp
    ROUND((p.base_cost * 3.5 * 1.5)::NUMERIC, 2) AS retail_price,
    false                                         AS is_on_sale,
    ROW_NUMBER() OVER (ORDER BY p.name)           AS sort_order
FROM public.agent_profiles ap
JOIN public.products p ON true      -- cross-join; every active product
WHERE ap.slug       = 'researchstore'
  AND p.is_active   = true
  AND p.is_banned   = false
ON CONFLICT (agent_id, product_id) DO NOTHING;

-- Step 3: Seed agent_inventory for the researchstore using the master
-- inventory_count from products so stock badges show correctly for guests.
-- Only insert rows that do not already exist.
INSERT INTO public.agent_inventory (agent_id, product_id, stock_count)
SELECT
    ap.id          AS agent_id,
    p.id           AS product_id,
    p.inventory_count
FROM public.agent_profiles ap
JOIN public.products p ON true
WHERE ap.slug           = 'researchstore'
  AND p.is_active       = true
  AND p.is_banned       = false
  AND p.inventory_count IS NOT NULL
ON CONFLICT (agent_id, product_id) DO UPDATE
    SET stock_count = EXCLUDED.stock_count;
