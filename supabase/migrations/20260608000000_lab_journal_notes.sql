-- Migration: 20260608000000_lab_journal_notes.sql

CREATE TABLE IF NOT EXISTS researcher_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    compound_slug TEXT, -- Optional: tie to a specific compound, null if general note
    title TEXT,
    note_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS researcher_notes_user_id_idx ON researcher_notes(user_id);
CREATE INDEX IF NOT EXISTS researcher_notes_compound_slug_idx ON researcher_notes(compound_slug);

-- Enable RLS
ALTER TABLE researcher_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notes" 
    ON researcher_notes FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" 
    ON researcher_notes FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
    ON researcher_notes FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
    ON researcher_notes FOR DELETE 
    USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_researcher_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_researcher_notes_updated_at_trigger
BEFORE UPDATE ON researcher_notes
FOR EACH ROW EXECUTE PROCEDURE update_researcher_notes_updated_at();
