-- Add reconstitution fields to researcher_inventory
ALTER TABLE researcher_inventory
ADD COLUMN IF NOT EXISTS recon_mg NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS recon_ml NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS recon_dose NUMERIC(10, 2);
