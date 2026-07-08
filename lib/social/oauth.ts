/**
 * OAuth authorization-code helpers for the social autoposter connect flow.
 *
 * Handles the one-time "authorize the app" step from SOCIAL-AUTOPOSTER-HANDOFF
 * Section B: build the provider authorize URL (with PKCE) and, on callback,
 * exchange the code for tokens that get persisted into public.social_accounts.
 *
 * Providers: x, google (YouTube), pinterest, meta (IG + FB Page).
 */
import crypto from 'crypto';
import type { Provider } from './types';

interface ProviderConf {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  usesPkce: boolean;
  extraAuth?: Record<string, string>;
}

export const PROVIDER_CONF: Record<Provider, ProviderConf> = {
  x: {
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: 'tweet.read tweet.write users.read offline.access',
    usesPkce: true,
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/youtube.upload',
    usesPkce: true,
    extraAuth: { access_type: 'offline', prompt: 'consent' },
  },
  pinterest: {
    authorizeUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scopes: 'boards:read pins:read pins:write',
    usesPkce: true,
  },
  meta: {
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes:
      'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish',
    usesPkce: false,
  },
  tiktok: {
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: 'video.publish',
    usesPkce: true,
  },
};

const ENV_KEYS: Record<Provider, [string, string]> = {
  x: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
  google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  pinterest: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET'],
  meta: ['META_APP_ID', 'META_APP_SECRET'],
  tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
};

export function isProvider(v: string): v is Provider {
  return v === 'x' || v === 'google' || v === 'pinterest' || v === 'meta' || v === 'tiktok';
}

export function clientCreds(provider: Provider): { id: string; secret: string } | null {
  const [idKey, secretKey] = ENV_KEYS[provider];
  const id = process.env[idKey];
  const secret = process.env[secretKey];
  return id && secret ? { id, secret } : null;
}

export function redirectUri(provider: Provider): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepnationlab.com').replace(/\/$/, '');
  return `${base}/api/social/oauth/${provider}/callback`;
}

export function makePkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthorizeUrl(
  provider: Provider,
  opts: { clientId: string; state: string; codeChallenge?: string },
): string {
  const conf = PROVIDER_CONF[provider];
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: redirectUri(provider),
    scope: conf.scopes,
    state: opts.state,
    ...(conf.extraAuth ?? {}),
  });
  if (conf.usesPkce && opts.codeChallenge) {
    params.set('code_challenge', opts.codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${conf.authorizeUrl}?${params.toString()}`;
}

export interface ExchangedTokens {
  access_token: string;
  refresh_token: string | null;
  expires_in: number | null;
  scope: string | null;
  account_ref: Record<string, string>;
  display_label: string | null;
}

/** Exchange an authorization code for tokens; handle Meta's multi-step flow. */
export async function exchangeCode(
  provider: Provider,
  code: string,
  codeVerifier?: string,
): Promise<ExchangedTokens> {
  const creds = clientCreds(provider);
  if (!creds) throw new Error(`${provider}: client id/secret env vars are not set`);

  if (provider === 'meta') return exchangeMeta(code, creds);

  const conf = PROVIDER_CONF[provider];
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(provider),
    client_id: creds.id,
  });
  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const basic = Buffer.from(`${creds.id}:${creds.secret}`).toString('base64');
  const res = await fetch(conf.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.access_token) {
    throw new Error(`${provider}: code exchange failed (${res.status}): ${JSON.stringify(json).slice(0, 300)}`);
  }

  const account_ref: Record<string, string> = {};
  if (provider === 'pinterest' && process.env.PINTEREST_BOARD_ID) {
    account_ref.board_id = process.env.PINTEREST_BOARD_ID;
  }
  if (provider === 'google' && process.env.YOUTUBE_CHANNEL_ID) {
    account_ref.channel_id = process.env.YOUTUBE_CHANNEL_ID;
  }

  return {
    access_token: String(json.access_token),
    refresh_token: json.refresh_token ? String(json.refresh_token) : null,
    expires_in: typeof json.expires_in === 'number' ? json.expires_in : null,
    scope: json.scope ? String(json.scope) : null,
    account_ref,
    display_label: null,
  };
}

/**
 * Meta: short-lived user token -> long-lived user token -> Page token + IG id.
 * Meta has no refresh_token; the long-lived Page token lasts ~60 days.
 */
async function exchangeMeta(
  code: string,
  creds: { id: string; secret: string },
): Promise<ExchangedTokens> {
  const conf = PROVIDER_CONF.meta;

  // 1) code -> short-lived user token
  const shortRes = await fetch(
    `${conf.tokenUrl}?${new URLSearchParams({
      client_id: creds.id,
      client_secret: creds.secret,
      redirect_uri: redirectUri('meta'),
      code,
    })}`,
  );
  const shortJson = (await shortRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!shortRes.ok || !shortJson.access_token) {
    throw new Error(`meta: code exchange failed (${shortRes.status}): ${JSON.stringify(shortJson).slice(0, 300)}`);
  }

  // 2) short-lived -> long-lived user token
  const longRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: creds.id,
      client_secret: creds.secret,
      fb_exchange_token: String(shortJson.access_token),
    })}`,
  );
  const longJson = (await longRes.json().catch(() => ({}))) as Record<string, unknown>;
  const userToken = String(longJson.access_token ?? shortJson.access_token);

  // 3) user token -> first managed Page + its token
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?${new URLSearchParams({
      access_token: userToken,
      fields: 'id,name,access_token,instagram_business_account',
    })}`,
  );
  const pagesJson = (await pagesRes.json().catch(() => ({}))) as {
    data?: Array<{
      id: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id: string };
    }>;
  };
  const page = pagesJson.data?.[0];
  if (!page) {
    throw new Error('meta: no managed Facebook Page found for this user');
  }

  const account_ref: Record<string, string> = {
    page_id: page.id,
    page_token: page.access_token ?? userToken,
  };
  if (page.instagram_business_account?.id) {
    account_ref.ig_business_id = page.instagram_business_account.id;
  }

  return {
    access_token: page.access_token ?? userToken,
    refresh_token: null,
    expires_in: typeof longJson.expires_in === 'number' ? longJson.expires_in : null,
    scope: conf.scopes,
    account_ref,
    display_label: page.name ?? null,
  };
}
