-- Add volume_pricing_enabled flag to agent_profiles
-- Default TRUE so all existing agents keep tiered pricing on
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS volume_pricing_enabled boolean NOT NULL DEFAULT true;
