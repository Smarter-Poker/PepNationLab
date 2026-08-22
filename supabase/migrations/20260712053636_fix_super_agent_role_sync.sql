-- Migration: sync role column with is_super_agent flag
-- Root cause: /api/admin/agents/super-upgrade only set is_super_agent=true
-- but never updated role, leaving role='agent' for all super agents promoted
-- via the admin UI toggle. This caused role-gated permission checks to fail.
--
-- Step 1: Fix all existing accounts where is_super_agent=true but role='agent'
UPDATE profiles
  SET role = 'super_agent', updated_at = now()
  WHERE is_super_agent = true
    AND role = 'agent'
    AND is_active = true;

-- Step 2: Add a DB-level constraint to prevent the split from ever happening again.
-- A check constraint enforces that is_super_agent=true always implies role='super_agent'.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_super_agent_role_sync;
ALTER TABLE profiles ADD CONSTRAINT chk_super_agent_role_sync
  CHECK (
    -- If is_super_agent is true, role must be 'super_agent'
    (is_super_agent = false OR role = 'super_agent')
    AND
    -- If role is 'super_agent', is_super_agent must be true
    (role != 'super_agent' OR is_super_agent = true)
  );
