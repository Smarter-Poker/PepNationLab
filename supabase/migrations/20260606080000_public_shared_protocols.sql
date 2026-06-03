-- Migration: Shared Research Protocols
-- Supports public share links for the Agent Discovery engine

CREATE TABLE IF NOT EXISTS public.shared_research_protocols (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    payload jsonb NOT NULL
);

-- Enable RLS
ALTER TABLE public.shared_research_protocols ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a new shared protocol (it's unauthenticated for guest storefront users)
CREATE POLICY "Anyone can insert shared protocols" ON public.shared_research_protocols
    FOR INSERT TO public
    WITH CHECK (true);

-- Anyone can read a shared protocol (for the viral link to work)
CREATE POLICY "Anyone can view shared protocols" ON public.shared_research_protocols
    FOR SELECT TO public
    USING (true);
