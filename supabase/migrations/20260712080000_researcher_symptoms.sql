-- Migration: researcher_symptoms table
-- Created: 2026-07-12

CREATE TABLE IF NOT EXISTS researcher_symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symptom_name TEXT NOT NULL CHECK (char_length(symptom_name) <= 200),
  severity SMALLINT NOT NULL CHECK (severity >= 1 AND severity <= 10),
  notes TEXT CHECK (char_length(notes) <= 2000),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE researcher_symptoms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own symptoms"
  ON researcher_symptoms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own symptoms"
  ON researcher_symptoms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own symptoms"
  ON researcher_symptoms FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_researcher_symptoms_user_id
  ON researcher_symptoms (user_id, logged_at DESC);
