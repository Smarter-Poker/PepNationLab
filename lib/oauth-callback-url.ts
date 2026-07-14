/**
 * Single Source Of Truth For The OAuth Callback URL Contract Between
 * /signup (Client - Builds The URL) And /auth/callback (Server - Parses It).
 *
 * REGRESSION GUARD - DO NOT CHANGE WITHOUT UPDATING BOTH SIDES + TESTS:
 * `ack`, `agentRef`, And `subAgentRef` MUST Travel As TOP-LEVEL Query Params
 * On The Callback URL - NEVER Encoded Inside The `redirect` Value. Nesting
 * Them Inside The URL-Encoded `redirect` Makes url.searchParams.get() Return
 * null On The Server (The Pre-f6c481fd Bug That Silently Dropped The
 * Registration Ack For Every Google Signup).
 *
 * Round-Trip Covered By __tests__/oauth-callback-url.test.ts, Which Simulates
 * Supabase Appending `?code=` After Google Returns.
 */

export interface OAuthCallbackUrlParams {
  /** window.location.origin on the client. */
  origin: string;
  /** Relative post-login path (already sanitized by the caller). */
  redirect: string;
  /** Set for new signups so the registration disclaimer ack is persisted. */
  ack?: 'registration';
  /** Referring agent slug (QR scan capture or manual entry). */
  agentRef?: string | null;
  /** Sub-agent uuid (QR ?sa= capture). Only meaningful alongside agentRef. */
  subAgentRef?: string | null;
}

export function buildOAuthCallbackUrl(p: OAuthCallbackUrlParams): string {
  const url = new URL('/auth/callback', p.origin);
  url.searchParams.set('redirect', p.redirect);
  if (p.ack) url.searchParams.set('ack', p.ack);
  if (p.agentRef) url.searchParams.set('agentRef', p.agentRef);
  if (p.subAgentRef) url.searchParams.set('subAgentRef', p.subAgentRef);
  return url.toString();
}
