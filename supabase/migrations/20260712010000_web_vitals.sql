-- Web Vitals RUM sink.
--
-- Team-owned, queryable Core Web Vitals field data (complements Vercel Speed
-- Insights, which reports to the Vercel dashboard). The browser reports each
-- metric to /api/vitals (service-role insert); admins can query trends here.
-- Enhancement roadmap Phase E (runtime feedback loop).

CREATE TABLE IF NOT EXISTS public.web_vitals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metric          TEXT NOT NULL,          -- LCP, CLS, INP, FCP, TTFB, FID
  value           NUMERIC NOT NULL,
  rating          TEXT,                   -- good | needs-improvement | poor
  path            TEXT,                   -- location.pathname
  navigation_type TEXT,                   -- navigate | reload | back-forward | prerender
  metric_id       TEXT,                   -- the web-vitals unique id (de-dupe)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS web_vitals_metric_time_idx ON public.web_vitals (metric, created_at DESC);
CREATE INDEX IF NOT EXISTS web_vitals_path_idx ON public.web_vitals (path);

ALTER TABLE public.web_vitals ENABLE ROW LEVEL SECURITY;

-- Reads are admin-only; inserts come exclusively from the service-role client
-- in /api/vitals (which bypasses RLS), so no INSERT policy is granted to
-- anon/authenticated -- a client cannot write directly.
DROP POLICY IF EXISTS "Admin read web vitals" ON public.web_vitals;
CREATE POLICY "Admin read web vitals" ON public.web_vitals
  FOR SELECT USING (public.is_admin());
