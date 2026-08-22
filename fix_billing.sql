BEGIN;

-- 1. Refund Cindy's credit account for the 2 orders that were wrongly charged
UPDATE profiles 
SET credit_used = credit_used - 171.08 - 104.60
WHERE id = 'b2ee9bf4-6dd5-41b3-9450-fee51aecb592';

-- Remove the wrong balance transactions for Cindy
DELETE FROM balance_transactions 
WHERE reference_id IN ('3c004a00-b1f5-4d77-a5ff-0c85e44e07e4', '41e31d2c-eedc-4e9b-bbe4-5a65b43a10d2') 
AND type = 'order_charge';

-- 2. Deduct Savage Brands' prepaid balance for the 3 approved orders (Eddie's and Cindy's 2 orders)
-- Total owed = 97.43 (Eddie) + 85.54 (Cindy) + 52.31 (Cindy) = 235.28
-- Wait, let me just call the deduct_prepaid_balance RPC for each one so they get separate ledger entries.

SELECT deduct_prepaid_balance('844dca4b-6f01-4779-bc95-bfa1e0809c0c', 97.43);
SELECT deduct_prepaid_balance('844dca4b-6f01-4779-bc95-bfa1e0809c0c', 85.54);
SELECT deduct_prepaid_balance('844dca4b-6f01-4779-bc95-bfa1e0809c0c', 52.31);

-- Let's update the description of the latest 3 transactions to link to the correct orders
WITH updated_txs AS (
  SELECT id, row_number() over (order by created_at desc) as rn
  FROM balance_transactions
  WHERE agent_id = '844dca4b-6f01-4779-bc95-bfa1e0809c0c' AND type = 'order_charge'
  ORDER BY created_at DESC LIMIT 3
)
UPDATE balance_transactions
SET 
  reference_id = CASE 
    WHEN u.rn = 1 THEN '41e31d2c-eedc-4e9b-bbe4-5a65b43a10d2'::uuid 
    WHEN u.rn = 2 THEN '3c004a00-b1f5-4d77-a5ff-0c85e44e07e4'::uuid 
    WHEN u.rn = 3 THEN '9edf26d7-2f8d-4890-89f5-fcea4668e47d'::uuid 
  END,
  reference_type = 'order',
  description = CASE 
    WHEN u.rn = 1 THEN 'Order charge (Cindy De La Mora - 41e31d2c)'
    WHEN u.rn = 2 THEN 'Order charge (Cindy De La Mora - 3c004a00)'
    WHEN u.rn = 3 THEN 'Order charge (Eddie Razz - 9edf26d7)'
  END
FROM updated_txs u
WHERE balance_transactions.id = u.id;

COMMIT;
