-- Migration for tracking Research Match Me queries
-- Used for anonymous, aggregate business intelligence (e.g. what goals do users search for)

CREATE TABLE IF NOT EXISTS public.research_match_analytics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    goal text NOT NULL,
    evidence_comfort text NOT NULL,
    wada_constraint text NOT NULL,
    risk_tolerance text NOT NULL,
    exclude_injectables boolean DEFAULT false,
    require_long_half_life boolean DEFAULT false
);

-- Service role access only for inserts from the edge/API
ALTER TABLE public.research_match_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Only Insert" ON public.research_match_analytics
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "Service Role Only Select" ON public.research_match_analytics
    FOR SELECT TO service_role
    USING (true);
