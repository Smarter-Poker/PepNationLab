-- Rename the stacks in public.products to remove the "The " prefix and prepend "Stack " to "KLOW"
update public.products
  set name = 'Glow Stack (TB10 + BPC10 + GHK50)'
  where name = 'The Glow Stack (TB10 + BPC10 + GHK50)';

update public.products
  set name = 'Wolverine Stack (BPC 10mg + TB 10mg)'
  where name = 'The Wolverine Stack (BPC 10mg + TB 10mg)';

update public.products
  set name = 'GH Synergy Stack (CJC 5mg + IPA 5mg)'
  where name = 'The GH Synergy Stack (CJC 5mg + IPA 5mg)';

update public.products
  set name = 'Shred Stack (Tirzepatide + AOD9604)'
  where name = 'The Shred Stack (Tirzepatide + AOD9604)';

update public.products
  set name = 'Limitless Stack (Semax + Selank)'
  where name = 'The Limitless Stack (Semax + Selank)';

update public.products
  set name = 'Stack KLOW (TB10+BPC10+GHK50+KPV10)'
  where name = 'KLOW (TB10+BPC10+GHK50+KPV10)';

-- Set image urls for the newly updated stack products
update public.products
  set image_url = '/images/products/wolverine-stack.png'
  where name = 'Wolverine Stack (BPC 10mg + TB 10mg)';

update public.products
  set image_url = '/images/products/shred-stack.png'
  where name = 'Shred Stack (Tirzepatide + AOD9604)';

update public.products
  set image_url = '/images/products/limitless-stack.png'
  where name = 'Limitless Stack (Semax + Selank)';

-- Clear backorder_days on Shred and Limitless stacks to remove backorder badges
update public.products
  set backorder_days = 0
  where name in ('Shred Stack (Tirzepatide + AOD9604)', 'Limitless Stack (Semax + Selank)');
