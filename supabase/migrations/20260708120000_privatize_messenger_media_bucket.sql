-- Privatize the messenger_media storage bucket.
--
-- Uploads still write the full PUBLIC object URL
-- (https://<ref>.supabase.co/storage/v1/object/public/messenger_media/<path>)
-- into messenger_messages.media_url, and GIFs still store an external Tenor URL
-- in the same column. Nothing about the upload flow or what the DB stores
-- changes.
--
-- With public = false, those stored /object/public/ URLs no longer resolve
-- directly. Instead, every read-time emit site re-signs the stored value into a
-- short-lived (1 hour) signed /object/sign/ URL via
-- lib/messenger/signMedia.ts before returning it to the client or broadcasting
-- it over realtime. An authenticated-only SELECT policy already exists on the
-- bucket; flipping the public flag is what makes that policy actually enforced.
--
-- Tenor GIF URLs and any non-messenger URLs are passed through unchanged by the
-- signer, so this only affects objects living in the messenger_media bucket.

UPDATE storage.buckets SET public = false WHERE id = 'messenger_media';
