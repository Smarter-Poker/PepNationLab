-- Update pre-mixed blend compounds to have themselves as their own stack components
-- This allows the UI to render their product images (vials) correctly in the Stacks page

UPDATE public.compounds 
SET stack_components = ARRAY['lemon-bottle'],
    is_stack = true
WHERE slug = 'lemon-bottle';

UPDATE public.compounds 
SET stack_components = ARRAY['l-carnitine'],
    is_stack = true
WHERE slug = 'l-carnitine';

UPDATE public.compounds 
SET stack_components = ARRAY['lipo-c'],
    is_stack = true
WHERE slug = 'lipo-c';
