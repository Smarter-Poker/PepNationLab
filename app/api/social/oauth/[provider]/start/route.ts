import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/admin-auth';
import {
  isProvider,
  clientCreds,
  makePkce,
  buildAuthorizeUrl,
  PROVIDER_CONF,
} from '@/lib/social/oauth';

/**
 * Begin the OAuth connect flow for a social platform (admin only).
 *
 *   GET /api/social/oauth/{provider}/start
 *
 * Generates CSRF state + a PKCE verifier, stashes them in short-lived httpOnly
 * cookies, and redirects the admin to the provider's authorize screen. The
 * matching /callback finishes the exchange and stores the tokens.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { provider } = await params;
  if (!isProvider(provider)) {
    return NextResponse.json({ error: 'Unknown Provider' }, { status: 400 });
  }

  const creds = clientCreds(provider);
  if (!creds) {
    return NextResponse.json(
      { error: `Missing client id/secret env vars for ${provider}` },
      { status: 400 },
    );
  }

  const state = crypto.randomBytes(16).toString('hex');
  const conf = PROVIDER_CONF[provider];
  const pkce = conf.usesPkce ? makePkce() : null;

  const url = buildAuthorizeUrl(provider, {
    clientId: creds.id,
    state,
    codeChallenge: pkce?.challenge,
  });

  const res = NextResponse.redirect(url);
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes to complete the flow
  };
  res.cookies.set('sa_oauth_state', state, cookieOpts);
  res.cookies.set('sa_oauth_provider', provider, cookieOpts);
  if (pkce) res.cookies.set('sa_oauth_verifier', pkce.verifier, cookieOpts);
  return res;
}
