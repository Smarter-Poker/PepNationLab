-- Migration: 20260608000010_cleanup_test_data.sql
-- Description: Cleanup test accounts, test data, and TomG/Tom lab journal test data

-- 1. Delete order items for test users and TomG/Tom
DELETE FROM public.order_items
WHERE order_id IN (
  SELECT id FROM public.orders
  WHERE buyer_id IN (
    SELECT id FROM public.profiles
    WHERE email ILIKE '%test%' 
       OR email ILIKE '%@test.com%'
       OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
  )
);

-- 2. Delete orders for test users and TomG/Tom
DELETE FROM public.orders
WHERE buyer_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 3. Delete disclaimer acceptances
DELETE FROM public.disclaimer_acceptances
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 4. Delete recently viewed
DELETE FROM public.researcher_recently_viewed
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 5. Delete favorites
DELETE FROM public.researcher_favorites
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 6. Delete lab journal notes
DELETE FROM public.researcher_notes
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 7. Delete comparisons
DELETE FROM public.researcher_comparisons
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 8. Delete doses
DELETE FROM public.researcher_doses
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 9. Delete biometrics
DELETE FROM public.researcher_biometrics
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 10. Delete reconstitution logs
DELETE FROM public.reconstitution_logs
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 11. Delete saved compounds
DELETE FROM public.user_saved_compounds
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 12. Delete reading queue
DELETE FROM public.user_reading_queue
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 13. Delete compound subscriptions
DELETE FROM public.user_compound_subscriptions
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 14. Delete user saved matches
DELETE FROM public.user_saved_matches
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 15. Delete notifications
DELETE FROM public.notifications
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 16. Delete push subscriptions
DELETE FROM public.push_subscriptions
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email ILIKE '%test%' 
     OR email ILIKE '%@test.com%'
     OR id IN ('dab132ed-c949-4ba9-b051-a79d6227edbf', '3c7df977-500d-4d93-9603-66b57ca81494')
);

-- 17. Delete from auth.users (this deletes profiles due to cascade)
DELETE FROM auth.users
WHERE email ILIKE '%test%' 
   OR email ILIKE '%@test.com%';
