-- Rename "Stack KLOW" to "KLOW STACK" in public.products
update public.products
  set name = 'KLOW STACK (TB10+BPC10+GHK50+KPV10)'
  where name = 'Stack KLOW (TB10+BPC10+GHK50+KPV10)';
