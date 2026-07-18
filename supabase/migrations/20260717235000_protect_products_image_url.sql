BEGIN;

-- First, clean up any existing violations so the constraint can be applied
UPDATE products
SET image_url = NULL
WHERE image_url LIKE '%/images/savage-brands/%';

-- Add a CHECK constraint to prevent brand-specific paths in the shared products table
ALTER TABLE products
ADD CONSTRAINT check_no_savage_brands_in_shared_products
CHECK (image_url IS NULL OR image_url NOT LIKE '%/images/savage-brands/%');

COMMIT;
