-- Migration: 20260608000001_researcher_comparisons.sql

CREATE TABLE IF NOT EXISTS researcher_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_ids TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS researcher_comparisons_user_id_idx ON researcher_comparisons(user_id);

ALTER TABLE researcher_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own comparisons" 
    ON researcher_comparisons FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own comparisons" 
    ON researcher_comparisons FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comparisons" 
    ON researcher_comparisons FOR DELETE 
    USING (auth.uid() = user_id);
