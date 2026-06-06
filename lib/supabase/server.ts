import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
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

export async function createServiceClient() {
  return createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
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
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  );
}
