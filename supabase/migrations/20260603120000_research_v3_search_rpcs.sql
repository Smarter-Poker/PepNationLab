-- ============================================================================
-- Research Library v3 search RPCs.
-- ----------------------------------------------------------------------------
-- Already applied to live DB ydsaqnnuwyvtyxgvrnys.
-- Committed for traceability + future fresh-restore.
-- ============================================================================

CREATE OR REPLACE FUNCTION search_compounds_rank(
  p_tsquery text,
  p_limit   int DEFAULT 20,
  p_offset  int DEFAULT 0
)
RETURNS TABLE (
  slug           text,
  display_name   text,
  evidence_tier  text,
  wada_status    text,
  category       text,
  compound_class text,
  plain_summary  text,
  snippet        text,
  score          real,
  total_count    bigint
) AS $$
DECLARE
  v_query tsquery;
BEGIN
  BEGIN
    v_query := to_tsquery('english', coalesce(nullif(p_tsquery, ''), 'pep'));
  EXCEPTION WHEN others THEN
    v_query := to_tsquery('english', 'zzzzzzzzzz');
  END;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      cs.slug, cs.display_name, cs.evidence_tier, cs.wada_status,
      cs.category, cs.compound_class, cs.plain_summary,
      ts_headline('english', cs.search_text, v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, FragmentDelimiter=" ... ", MaxWords=18, MinWords=6'
      ) AS snippet,
      ts_rank_cd(cs.search_vec, v_query, 32) AS score,
      count(*) OVER () AS total_count
    FROM compound_search cs
    WHERE cs.search_vec @@ v_query
  )
  SELECT * FROM ranked
  ORDER BY score DESC, display_name ASC
  LIMIT greatest(p_limit, 1)
  OFFSET greatest(p_offset, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_compounds_rank(text, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION search_compounds_trgm(
  p_term  text,
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  slug           text,
  display_name   text,
  evidence_tier  text,
  wada_status    text,
  category       text,
  compound_class text,
  plain_summary  text,
  snippet        text,
  score          real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.slug, cs.display_name, cs.evidence_tier, cs.wada_status,
    cs.category, cs.compound_class, cs.plain_summary,
    cs.display_name AS snippet,
    similarity(lower(cs.search_text), lower(coalesce(p_term, ''))) AS score
  FROM compound_search cs
  WHERE lower(cs.search_text) % lower(coalesce(p_term, ''))
  ORDER BY score DESC, cs.display_name ASC
  LIMIT greatest(p_limit, 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_compounds_trgm(text, int) TO anon, authenticated;
