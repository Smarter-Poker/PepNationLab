-- Drop the stale slug_format CHECK which had an incomplete reserved list
ALTER TABLE public.agent_profiles
  DROP CONSTRAINT IF EXISTS slug_format;

-- Replace the trigger function to cover the union of all reserved routes
CREATE OR REPLACE FUNCTION public.agent_profiles_slug_not_reserved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reserved constant text[] := array[
    '_next', 'about', 'accept-disclaimer', 'account', 'admin', 'admin-panel', 'advertising', 'api', 'app', 'assets', 'auth', 'become-agent', 'blog', 'cart', 'checkout', 'coa', 'compliance', 'contact', 'dashboard', 'disclaimer', 'docs', 'favicon.ico', 'feed.xml', 'find-a-peptide', 'forgot-password', 'health', 'help', 'inbox', 'invite', 'lab-journal', 'lab-tools', 'llms-full.txt', 'llms.txt', 'login', 'logout', 'manifest.webmanifest', 'message', 'messages', 'messenger', 'monitoring', 'onboarding', 'order', 'orders', 'peptide-101', 'peptides', 'pricing', 'privacy', 'product', 'products', 'public', 'register', 'research', 'researchers', 'reset-password', 'robots', 'robots.txt', 'sales', 'shelf-life', 'shipping', 'signin', 'signup', 'sitemap', 'sitemap.xml', 'staff', 'statements', 'status', 'support', 'sw.js', 'terms', 'test-card', 'transactions', 'users', 'wallet', 'www'
  ];
BEGIN
  NEW.slug := lower(btrim(coalesce(NEW.slug, '')));

  IF NEW.slug = ANY (reserved) THEN
    RAISE EXCEPTION 'Storefront URL "%" is reserved by the site.', NEW.slug
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
