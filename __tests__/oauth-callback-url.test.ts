import { describe, it, expect } from 'vitest';
import { buildOAuthCallbackUrl } from '@/lib/oauth-callback-url';

/**
 * REGRESSION GUARD for the OAuth callback URL contract between /signup
 * (which builds the URL) and /auth/callback (which parses it with
 * url.searchParams.get()).
 *
 * The bug class this protects against: encoding ack/agentRef inside the
 * `redirect` value instead of as top-level params made them invisible to the
 * server (pre-f6c481fd, the registration ack was silently dropped for every
 * Google signup). These tests parse the built URL exactly the way the
 * callback route does — including after Supabase appends `?code=` — so any
 * change that re-nests the params fails CI.
 */

const ORIGIN = 'https://pepnationlab.com';

/** Parse the way app/auth/callback/route.ts does. */
function serverSideRead(urlStr: string) {
  const url = new URL(urlStr);
  return {
    redirect: url.searchParams.get('redirect'),
    ack: url.searchParams.get('ack'),
    agentRef: url.searchParams.get('agentRef') ?? undefined,
    subAgentRef: url.searchParams.get('subAgentRef') ?? undefined,
  };
}

/** Simulate Supabase/GoTrue appending the auth code after Google returns. */
function withAuthCode(urlStr: string) {
  const url = new URL(urlStr);
  url.searchParams.set('code', 'pkce-code-abc123');
  return url.toString();
}

describe('buildOAuthCallbackUrl', () => {
  it('produces a /auth/callback URL on the given origin', () => {
    const built = buildOAuthCallbackUrl({ origin: ORIGIN, redirect: '/dashboard' });
    const url = new URL(built);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe('/auth/callback');
  });

  it('keeps ack, agentRef, and subAgentRef as TOP-LEVEL params the server can read', () => {
    const built = buildOAuthCallbackUrl({
      origin: ORIGIN,
      redirect: '/dashboard',
      ack: 'registration',
      agentRef: 'savagebrands',
      subAgentRef: '123e4567-e89b-42d3-a456-426614174000',
    });
    const parsed = serverSideRead(built);
    expect(parsed.redirect).toBe('/dashboard');
    expect(parsed.ack).toBe('registration');
    expect(parsed.agentRef).toBe('savagebrands');
    expect(parsed.subAgentRef).toBe('123e4567-e89b-42d3-a456-426614174000');
  });

  it('survives the OAuth round-trip (Supabase appending ?code=)', () => {
    const built = withAuthCode(buildOAuthCallbackUrl({
      origin: ORIGIN,
      redirect: '/dashboard',
      ack: 'registration',
      agentRef: 'savagebrands',
    }));
    const url = new URL(built);
    expect(url.searchParams.get('code')).toBe('pkce-code-abc123');
    expect(url.searchParams.get('ack')).toBe('registration');
    expect(url.searchParams.get('agentRef')).toBe('savagebrands');
    expect(url.searchParams.get('redirect')).toBe('/dashboard');
  });

  it('omits agentRef/subAgentRef when absent (skip / house-store path)', () => {
    const built = buildOAuthCallbackUrl({
      origin: ORIGIN,
      redirect: '/dashboard',
      ack: 'registration',
      agentRef: null,
      subAgentRef: null,
    });
    const parsed = serverSideRead(built);
    expect(parsed.ack).toBe('registration');
    expect(parsed.agentRef).toBeUndefined();
    expect(parsed.subAgentRef).toBeUndefined();
  });

  it('a redirect containing its own query string never swallows the other params', () => {
    const built = buildOAuthCallbackUrl({
      origin: ORIGIN,
      redirect: '/products?category=peptides&page=2',
      ack: 'registration',
      agentRef: 'savagebrands',
    });
    const parsed = serverSideRead(built);
    // The nested query survives inside redirect...
    expect(parsed.redirect).toBe('/products?category=peptides&page=2');
    // ...and ack/agentRef are still top-level readable.
    expect(parsed.ack).toBe('registration');
    expect(parsed.agentRef).toBe('savagebrands');
  });

  it('percent-encodes agent slugs safely', () => {
    const built = buildOAuthCallbackUrl({
      origin: ORIGIN,
      redirect: '/dashboard',
      agentRef: 'agent_with-chars',
    });
    expect(serverSideRead(built).agentRef).toBe('agent_with-chars');
  });
});
