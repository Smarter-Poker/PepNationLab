-- Sync existing profiles so that credit accounts have auto_approve_orders = true
-- and prepaid accounts have auto_approve_orders = false

UPDATE profiles
SET auto_approve_orders = true
WHERE account_type = 'credit';

UPDATE profiles
SET auto_approve_orders = false
WHERE account_type = 'prepaid';
