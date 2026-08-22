import 'server-only';
import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseUrl } from '@/lib/supabase/url';

export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    getSupabaseUrl(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from Server Component - cookies can't be set
          }
        },
      },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  );

  // Wrap auth.getUser to prevent unhandled refresh token errors from crashing server component renders
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (jwt?: string) => {
    try {
      return await originalGetUser(jwt);
    } catch (err) {
      console.error('[createClient] getUser error caught:', err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { data: { user: null }, error: err as any };
    }
  };

  return client;
}

/**
 * getCachedUser - React cache()-deduped per-request auth lookup.
 *
 * supabase.auth.getUser() is a NETWORK round-trip to Supabase Auth, and in a
 * single request the layout and the page under it each call it. cache()
 * memoizes the result for the lifetime of one server render pass, so the
 * network call happens at most once per request. Uses the same SSR client
 * factory above (including its getUser error guard), so the returned user is
 * shape-identical to `(await supabase.auth.getUser()).data.user`. The client
 * that performed the lookup is returned for convenience; call sites that run
 * additional queries may keep creating their own client via createClient().
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error, supabase };
});

export async function createServiceClient() {
  return createServerClient(
    getSupabaseUrl(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    {
      cookies: {
        getAll() { return []; },
        setAll() { /* service role - no cookie setting needed */ },
      },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  );
}

/**
 * createAdminClient - uses raw @supabase/supabase-js (NOT @supabase/ssr).
 * This is the ONLY client that truly bypasses RLS with the service role key.
 * Use this for server-side operations that must write across RLS boundaries
 * (e.g. creating/updating researcher profiles from an agent route).
 * NEVER expose this client to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    getSupabaseUrl(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  );
}
