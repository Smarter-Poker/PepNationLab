import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { isProvider, exchangeCode } from '@/lib/social/oauth';

/**
 * OAuth callback - finishes the connect flow and stores tokens (admin only).
 *
 *   GET /api/social/oauth/{provider}/callback?code=...&state=...
 *
 * Verifies the CSRF state cookie, exchanges the code (with PKCE verifier),
 * upserts the credentials into public.social_accounts, and redirects back to
 * the admin dashboard with a status flag.
 */
export const dynamic = 'force-dynamic';

function backTo(status: string, provider: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepnationlab.com').replace(/\/$/, '');
  return NextResponse.redirect(`${base}/admin?social=${provider}_${status}`);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { provider } = await params;
  if (!isProvider(provider)) {
    return NextResponse.json({ error: 'Unknown Provider' }, { status: 400 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  if (oauthError) return backTo('error', provider);
  if (!code || !state) return backTo('error', provider);

  const jar = await cookies();
  const expectedState = jar.get('sa_oauth_state')?.value;
  const cookieProvider = jar.get('sa_oauth_provider')?.value;
  const verifier = jar.get('sa_oauth_verifier')?.value;

  if (!expectedState || state !== expectedState || cookieProvider !== provider) {
    return backTo('state_mismatch', provider);
  }

  let tokens;
  try {
    tokens = await exchangeCode(provider, code, verifier);
  } catch {
    return backTo('exchange_failed', provider);
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from('social_accounts').upsert(
    {
      provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      scope: tokens.scope,
      account_ref: tokens.account_ref,
      display_label: tokens.display_label,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'provider' },
  );

  // clear the flow cookies regardless of outcome
  const res = error ? backTo('store_failed', provider) : backTo('connected', provider);
  res.cookies.delete('sa_oauth_state');
  res.cookies.delete('sa_oauth_provider');
  res.cookies.delete('sa_oauth_verifier');
  return res;
}
