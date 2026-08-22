-- Migration to convert Savage Brands to prepaid balance and deduct a $194.90 sale.

DO $$
DECLARE
    v_savage_id UUID;
BEGIN
    SELECT id INTO v_savage_id FROM public.agent_profiles WHERE slug = 'savagebrands' LIMIT 1;
    
    IF v_savage_id IS NOT NULL THEN
        UPDATE public.profiles
        SET 
            account_type = 'prepaid',
            credit_limit = 0,
            credit_used = 0,
            prepaid_balance = 5000.00 - 194.90,
            updated_at = NOW()
        WHERE id = v_savage_id;
    END IF;
END $$;
