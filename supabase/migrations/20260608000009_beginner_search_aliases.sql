-- Migration: Add layman search keywords to popular compounds
-- 1. BPC-157 & TB-500: injury, sore joints, tendonitis, healing speed
-- 2. GHK-Cu: wrinkles, hair loss, skin aging, stretch marks
-- 3. NAD+ & Epithalon: low energy, anti-aging, deep sleep

UPDATE compounds
SET aliases = array_cat(aliases, ARRAY['injury', 'sore joints', 'tendonitis', 'healing speed'])
WHERE slug = 'bpc-157' AND NOT (aliases @> ARRAY['injury']);

UPDATE compounds
SET aliases = array_cat(aliases, ARRAY['injury', 'sore joints', 'tendonitis', 'healing speed'])
WHERE slug = 'tb-500' AND NOT (aliases @> ARRAY['injury']);

UPDATE compounds
SET aliases = array_cat(aliases, ARRAY['wrinkles', 'hair loss', 'skin aging', 'stretch marks'])
WHERE slug = 'ghk-cu' AND NOT (aliases @> ARRAY['wrinkles']);

UPDATE compounds
SET aliases = array_cat(aliases, ARRAY['low energy', 'anti-aging', 'deep sleep'])
WHERE slug = 'nad-plus' AND NOT (aliases @> ARRAY['low energy']);

UPDATE compounds
SET aliases = array_cat(aliases, ARRAY['low energy', 'anti-aging', 'deep sleep'])
WHERE slug = 'epithalon' AND NOT (aliases @> ARRAY['low energy']);

-- Rebuild the materialized search view concurrent index
SELECT refresh_compound_search();
