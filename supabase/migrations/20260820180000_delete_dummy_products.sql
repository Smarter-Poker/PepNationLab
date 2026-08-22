SET session_replication_role = replica;
DELETE FROM agent_products WHERE product_id IN (SELECT id FROM products WHERE name ILIKE '%BPC-157 Research Grade%' OR name ILIKE '%Epithalon%Test%' OR name ILIKE '%Test Print%');
DELETE FROM products WHERE name ILIKE '%BPC-157 Research Grade%' OR name ILIKE '%Epithalon%Test%' OR name ILIKE '%Test Print%';
SET session_replication_role = DEFAULT;
