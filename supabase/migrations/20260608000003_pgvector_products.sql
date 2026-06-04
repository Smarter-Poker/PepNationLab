-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Add embedding column
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS products_embedding_idx ON products USING hnsw (embedding vector_cosine_ops);

-- Create simple match function
CREATE OR REPLACE FUNCTION match_products_vector(
  query_embedding vector(768),
  match_threshold float,
  match_limit int
)
RETURNS TABLE (
  product_id uuid,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id as product_id,
    1 - (embedding <=> query_embedding) as similarity
  FROM products
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
    AND is_active = true
    AND is_banned = false
  ORDER BY embedding <=> query_embedding
  LIMIT match_limit;
$$;
