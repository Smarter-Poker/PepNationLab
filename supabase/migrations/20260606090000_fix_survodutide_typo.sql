update public.products set compound_slug='survodutide' where compound_slug = 'survotutide';
update public.products set compound_slug='survodutide' where compound_slug is null and name ilike 'Survodutide%';
