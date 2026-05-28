-- Add bundles_config JSONB column to agent_profiles for research bundles
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS bundles_config JSONB DEFAULT '[]'::jsonb;

-- Bundle structure:
-- [
--   {
--     "id": "uuid",
--     "name": "Research Bundle Name",
--     "description": "Bundle description",
--     "product_ids": ["prod-uuid-1", "prod-uuid-2", "prod-uuid-3"],
--     "discount_percent": 15,
--     "is_active": true,
--     "created_at": "ISO timestamp"
--   }
-- ]
