-- Add label_url to orders table to persist Shippo PDFs
ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_url TEXT;
