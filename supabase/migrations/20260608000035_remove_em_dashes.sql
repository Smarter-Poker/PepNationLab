-- Remove all em dashes (—) from public.compounds and public.products columns
UPDATE public.compounds
SET 
  display_name = replace(display_name, '—', '-'),
  mechanism = replace(mechanism, '—', '-'),
  benefits = replace(benefits, '—', '-'),
  compound_class = replace(compound_class, '—', '-'),
  molecular_target = replace(molecular_target, '—', '-'),
  plain_summary = replace(plain_summary, '—', '-'),
  eli5_summary = replace(eli5_summary, '—', '-'),
  typical_frequency = replace(typical_frequency, '—', '-'),
  half_life = replace(half_life, '—', '-'),
  pk_summary = replace(pk_summary, '—', '-'),
  side_effects = replace(side_effects, '—', '-'),
  warnings = replace(warnings, '—', '-'),
  regulatory = replace(regulatory, '—', '-');

UPDATE public.products
SET
  name = replace(name, '—', '-'),
  description = replace(description, '—', '-');
