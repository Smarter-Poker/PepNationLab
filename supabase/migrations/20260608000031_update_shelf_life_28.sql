-- Migration to update reconstitution shelf life from 21 to 28 days for stability consistency
UPDATE public.compounds
SET 
  reconstitution_shelf_days = 28,
  handling = jsonb_set(COALESCE(handling, '{}'::jsonb), '{reconstituted_days}', '28'::jsonb)
WHERE reconstitution_shelf_days = 21;
