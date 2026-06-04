-- Recreate compounds.embedding as vector(768) for gemini-embedding-001 compatibility
-- and define similarity search matching function.

-- Drop the old 1536-dimensional embedding column if it exists
ALTER TABLE public.compounds DROP COLUMN IF EXISTS embedding CASCADE;

-- Recreate as 768-dimensional vector
ALTER TABLE public.compounds ADD COLUMN IF NOT EXISTS embedding public.vector(768);

-- Create HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS compounds_embedding_idx ON public.compounds USING hnsw (embedding public.vector_cosine_ops);

-- Create pgvector search match function for compounds
CREATE OR REPLACE FUNCTION public.match_compounds_vector(
  query_embedding public.vector(768),
  match_threshold float,
  match_limit int
)
RETURNS TABLE (
  id uuid,
  slug text,
  display_name text,
  evidence_tier text,
  wada_status text,
  plain_summary text,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.slug,
    c.display_name,
    c.evidence_tier,
    c.wada_status,
    c.plain_summary,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  FROM public.compounds c
  WHERE c.embedding IS NOT NULL
    AND (c.recommended_action <> 'remove' OR c.recommended_action IS NULL)
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_limit;
$$;

-- Grant execute permissions to public access roles
GRANT EXECUTE ON FUNCTION public.match_compounds_vector(public.vector(768), float, int) TO anon, authenticated;
