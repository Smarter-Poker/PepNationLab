-- Lab Journal: Progress Photos pinned to the protocol timeline by taken_at.
-- Applied to project ydsaqnnuwyvtyxgvrnys (pepnationlab-prod) on 2026-07-07.

CREATE TABLE IF NOT EXISTS public.researcher_progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  taken_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rpp_user_taken ON public.researcher_progress_photos(user_id, taken_at DESC);

ALTER TABLE public.researcher_progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rpp_own_all" ON public.researcher_progress_photos;
CREATE POLICY "rpp_own_all" ON public.researcher_progress_photos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Private storage bucket; images are served to the owner via server-side signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false)
ON CONFLICT (id) DO NOTHING;
