-- Add agent_products to the Supabase Realtime publication so that the
-- client-side Realtime subscription in useCatalogRefresh() fires when
-- an admin changes a product price, visibility, or adds/removes a product.
--
-- Without this, the supabase.channel().on('postgres_changes', ...) listener
-- subscribes successfully but Postgres never broadcasts changes for this table,
-- so the localStorage cache invalidation on admin edits is silently dead.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agent_products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_products;
  END IF;
END;
$$;
