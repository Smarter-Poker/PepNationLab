-- Ban highly dangerous peptides from the catalog to prevent liability.
UPDATE public.products
SET is_banned = true
WHERE name ILIKE '%PT-141%'
   OR name ILIKE '%Adipotide%'
   OR name ILIKE '%MT-2%'
   OR name ILIKE '%Melanotan%';
