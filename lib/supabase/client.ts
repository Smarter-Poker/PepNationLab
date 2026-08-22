import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';
import { getSupabaseUrl } from '@/lib/supabase/url';

export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl() || 'https://placeholder.supabase.co',
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key').trim()
  );
}
