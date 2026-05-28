-- Add shippo_api_key to agent_profiles table
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS shippo_api_key TEXT;
