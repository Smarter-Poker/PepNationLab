-- Last two rows in the entire catalog that would still render the blank clear
-- vial. Both are on the Savage store /rachel: the Limitless Stack and the
-- Shred Stack had custom_image_url NULL, so on a Savage-classified store
-- getProductImage() fell into its Savage branch and returned
-- /images/peptide_clear.png.
--
-- Values taken from the savagebrands root store, which is the brand authority
-- for Savage art.
--
-- NOTE: Savage downlines are inconsistent on the Shred Stack -- the root store
-- uses savage-shredder-stack.jpg while 18 downlines use stack-weight-loss.jpg.
-- Both render a real vial, so that is a brand-consistency question rather than
-- a bug, and is deliberately not changed here.
--
-- After this migration the catalog-wide audit returns:
--   blank_vial_rows_remaining   = 0
--   contaminated_rows_remaining = 0

update agent_products ap
set custom_image_url = '/images/savage-brands/stack-limitless.jpg'
from products p, agent_profiles prof
where p.id = ap.product_id
  and prof.id = ap.agent_id
  and prof.slug = 'rachel'
  and p.slug = 'the-limitless-stack-semax-selank'
  and ap.custom_image_url is null;

update agent_products ap
set custom_image_url = '/images/savage-brands/savage-shredder-stack.jpg'
from products p, agent_profiles prof
where p.id = ap.product_id
  and prof.id = ap.agent_id
  and prof.slug = 'rachel'
  and p.slug = 'the-shred-stack-tirzepatide-aod9604'
  and ap.custom_image_url is null;
