-- Add covering btree indexes on foreign-key columns that lacked one.
-- Applied to prod (ydsaqnnuwyvtyxgvrnys) via Supabase MCP as ledger version 20260707211658.
-- Resolves the "Unindexed foreign keys" performance-advisor findings (84 columns).
-- Idempotent and self-selecting: only creates indexes for FK columns that are not
-- already the leading column of an existing index. All affected tables are small
-- (<= ~8.4k rows) so non-concurrent creation is safe.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    WITH fk AS (
      SELECT c.conrelid,
             c.conrelid::regclass::text AS tbl,
             a.attname AS col,
             c.conkey[1] AS attnum
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND array_length(c.conkey, 1) = 1
    )
    SELECT tbl, col,
           left('idx_' || regexp_replace(tbl, '[^a-z0-9_]', '_', 'g') || '_' || col, 63) AS idxname
    FROM fk
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = fk.conrelid AND i.indkey[0] = fk.attnum
    )
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)', r.idxname, r.tbl, r.col);
  END LOOP;
END $$;
