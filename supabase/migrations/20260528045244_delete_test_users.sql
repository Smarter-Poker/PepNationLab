-- Delete orders and order_items for test users
DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders
  WHERE buyer_id IN (
    SELECT id FROM profiles
    WHERE full_name ILIKE '%test%' OR email ILIKE '%test%'
  )
);

DELETE FROM orders
WHERE buyer_id IN (
  SELECT id FROM profiles
  WHERE full_name ILIKE '%test%' OR email ILIKE '%test%'
);

-- Delete from disclaimer_acceptances
DELETE FROM disclaimer_acceptances
WHERE user_id IN (
  SELECT id FROM profiles
  WHERE full_name ILIKE '%test%' OR email ILIKE '%test%'
);

-- Delete from auth.users
DELETE FROM auth.users
WHERE email ILIKE '%test%';
