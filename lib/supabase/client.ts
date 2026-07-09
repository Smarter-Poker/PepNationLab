import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseUrl } from '@/lib/supabase/url';

export function createClient() {
  return createBrowserClient(
    getSupabaseUrl() || 'https://placeholder.supabase.co',
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key').trim()
  );
}
