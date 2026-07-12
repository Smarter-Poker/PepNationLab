-- ============================================================
-- Fix logo upload RLS: drop all conflicting storefront-assets
-- INSERT/UPDATE policies and replace with a single clean policy
-- that the server-side upload route (service-role) bypasses
-- entirely. Client-side reads remain unrestricted (public bucket).
-- ============================================================

-- Drop every old INSERT policy on storefront-assets
DROP POLICY IF EXISTS "Agents storefront assets upload"    ON storage.objects;
DROP POLICY IF EXISTS "storefront-assets agent write"      ON storage.objects;

-- Drop every old UPDATE policy on storefront-assets
DROP POLICY IF EXISTS "Agents storefront assets update"    ON storage.objects;
DROP POLICY IF EXISTS "storefront-assets agent update"     ON storage.objects;

-- Drop every old DELETE policy on storefront-assets
DROP POLICY IF EXISTS "storefront-assets agent delete"     ON storage.objects;

-- Drop the old SELECT policy (we'll recreate it cleanly)
DROP POLICY IF EXISTS "Public storefront assets"           ON storage.objects;

-- ── Recreate clean single-policy set ─────────────────────────

-- Anyone can read (bucket is public, but this makes RLS explicit)
CREATE POLICY "storefront_assets_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'storefront-assets');

-- Only authenticated agents/admins can insert
-- First path segment must equal the uploading user's UID.
-- The server-side /api/agent/storefront/logo-upload route uses
-- the service-role key which bypasses this entirely, but the
-- policy is here as a belt-and-suspenders safety net for any
-- future direct browser uploads.
CREATE POLICY "storefront_assets_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'storefront-assets'
  AND auth.role() = 'authenticated'
  AND (
    public.is_admin()
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('agent', 'super_agent')
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

-- Owners (or admins) can update their own files
CREATE POLICY "storefront_assets_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'storefront-assets'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Owners (or admins) can delete their own files
CREATE POLICY "storefront_assets_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'storefront-assets'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
