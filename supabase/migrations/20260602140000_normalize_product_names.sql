-- Catalog normalization: fix inconsistent product names so the storefront
-- grid's name-based variant grouping collapses them into one card, and correct
-- a typo. Deliberately does NOT rename "Bac. water" (matched by name elsewhere).
update public.products set name = '5-Amino-1MQ', updated_at = now()
  where name = '5-amino-1mq';

update public.products set name = 'Survodutide', updated_at = now()
  where name = 'Survotutide';
