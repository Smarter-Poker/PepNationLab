-- Add min_overall_qty to agent_profiles
ALTER TABLE agent_profiles 
  ADD COLUMN IF NOT EXISTS min_overall_qty INTEGER DEFAULT 1;
