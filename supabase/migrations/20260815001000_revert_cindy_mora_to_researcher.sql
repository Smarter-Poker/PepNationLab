-- Revert Cindy De La Mora to researcher role and assign under Savage Brands
DO $$
DECLARE
    v_savage_id UUID;
    v_target_id UUID;
BEGIN
    -- Get Savage Brands ID
    SELECT id INTO v_savage_id FROM public.agent_profiles WHERE slug = 'savagebrands' LIMIT 1;
    
    IF v_savage_id IS NULL THEN
        RAISE NOTICE 'Savage Brands not found, skipping.';
        RETURN;
    END IF;

    -- Find Cindy De La Mora
    SELECT id INTO v_target_id 
    FROM public.profiles 
    WHERE full_name ILIKE '%Cindy%De%La%Mora%'
    LIMIT 1;
    
    IF v_target_id IS NOT NULL THEN
        UPDATE public.profiles
        SET role = 'researcher',
            referring_agent_id = v_savage_id
        WHERE id = v_target_id;
        
        RAISE NOTICE 'Successfully updated Cindy De La Mora to researcher under Savage Brands.';
    ELSE
        RAISE NOTICE 'Cindy De La Mora not found.';
    END IF;
END $$;
