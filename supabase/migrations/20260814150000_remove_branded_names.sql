-- Migration to remove FDA non-compliant branded references
-- Removes 'Ozempic', 'Wegovy', 'Mounjaro' from aliases and eli5_summary

UPDATE public.compounds
SET aliases = array_remove(array_remove(array_remove(array_remove(array_remove(aliases, 'Ozempic'), 'Wegovy'), 'Mounjaro'), 'Zepbound'), 'Rybelsus')
WHERE aliases @> ARRAY['Ozempic']::text[]
   OR aliases @> ARRAY['Wegovy']::text[]
   OR aliases @> ARRAY['Mounjaro']::text[]
   OR aliases @> ARRAY['Zepbound']::text[]
   OR aliases @> ARRAY['Rybelsus']::text[];

UPDATE public.compounds
SET eli5_summary = REPLACE(eli5_summary, 'It''s the active ingredient in Ozempic and Wegovy. ', '')
WHERE eli5_summary LIKE '%Ozempic%';

UPDATE public.compounds
SET eli5_summary = REPLACE(eli5_summary, 'It''s the active ingredient in Mounjaro and Zepbound. ', '')
WHERE eli5_summary LIKE '%Mounjaro%';
