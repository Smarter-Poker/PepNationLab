-- ====================================================================
-- Migration: 20260608000020_agent_username_cooldown.sql
-- Description: Adds cooldown and history tracking for agent User Names.
-- ====================================================================

ALTER TABLE public.agent_profiles 
  ADD COLUMN IF NOT EXISTS display_name_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_display_name TEXT,
  ADD COLUMN IF NOT EXISTS previous_display_name_dismissed BOOLEAN DEFAULT FALSE;
