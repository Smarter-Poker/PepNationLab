-- Migration: Save Research Matches to Dashboard
-- Tracks user-saved "Match Me" engine results and parameters

CREATE TABLE IF NOT EXISTS public.user_saved_matches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    match_input jsonb NOT NULL,
    results jsonb NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_saved_matches ENABLE ROW LEVEL SECURITY;

-- Users can insert their own matches
CREATE POLICY "Users can insert own saved matches" ON public.user_saved_matches
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can view their own matches
CREATE POLICY "Users can view own saved matches" ON public.user_saved_matches
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Users can delete their own matches
CREATE POLICY "Users can delete own saved matches" ON public.user_saved_matches
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Create index on user_id for faster dashboard queries
CREATE INDEX IF NOT EXISTS user_saved_matches_user_id_idx ON public.user_saved_matches(user_id);
