-- 1. Add avatar_url to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create Avatars Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Storage Bucket Policies
-- Allow anyone to select/view avatars
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload and update their own avatars
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid() = owner AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND 
  auth.uid() = owner
);

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND 
  auth.uid() = owner
);

-- 4. Update get_user_conversations RPC
-- We need to drop the old signature and replace it because the RETURNS TABLE changes.
DROP FUNCTION IF EXISTS public.fn_get_user_conversations(uuid);

CREATE OR REPLACE FUNCTION public.fn_get_user_conversations(p_user uuid)
 RETURNS TABLE(conversation_id uuid, type text, title text, avatar_url text, last_message_text text, last_message_at timestamp with time zone, unread_count integer, is_pinned boolean, is_muted boolean, counterparty_id uuid, counterparty_full_name text, counterparty_username text, counterparty_role text, counterparty_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller UUID := auth.uid();
  caller_role_in_jwt TEXT;
  caller_profile_role TEXT;
BEGIN
  caller_role_in_jwt := auth.role();

  IF caller_role_in_jwt = 'service_role'
     OR current_user IN ('postgres','supabase_admin')
  THEN
    NULL;
  ELSIF caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501';
  ELSIF p_user IS DISTINCT FROM caller THEN
    SELECT role::TEXT INTO caller_profile_role FROM public.profiles WHERE id = caller;
    IF caller_profile_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    c.type::TEXT,
    c.title,
    c.avatar_url,
    c.last_message_text,
    c.last_message_at,
    p.unread_count,
    p.is_pinned,
    p.is_muted,
    cp.user_id AS counterparty_id,
    cprofile.full_name AS counterparty_full_name,
    cprofile.username AS counterparty_username,
    cprofile.role::TEXT AS counterparty_role,
    cprofile.avatar_url AS counterparty_avatar_url
  FROM public.messenger_participants p
  JOIN public.messenger_conversations c ON c.id = p.conversation_id
  LEFT JOIN LATERAL (
    SELECT mp.user_id
    FROM public.messenger_participants mp
    WHERE mp.conversation_id = c.id
      AND mp.user_id <> p_user
      AND c.type = 'direct'
    LIMIT 1
  ) cp ON true
  LEFT JOIN public.profiles cprofile ON cprofile.id = cp.user_id
  WHERE p.user_id = p_user
    AND c.is_archived = false
    AND COALESCE((p.settings ->> 'archived')::boolean, false) = false
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT 200;
END;
$function$;
