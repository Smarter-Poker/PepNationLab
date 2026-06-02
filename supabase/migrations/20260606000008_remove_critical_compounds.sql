-- Remove critical and high risk compounds
DELETE FROM public.products WHERE compound_slug IN ('dermorphin', 'hgh-191aa', 'mt-2', 'adipotide');
DELETE FROM public.compounds WHERE slug IN ('dermorphin', 'hgh-191aa', 'mt-2', 'adipotide');
