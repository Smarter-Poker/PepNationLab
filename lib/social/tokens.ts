/**
 * Token resolution for the social autoposter.
 *
 * Each platform authenticates through an OAuth provider. This module resolves a
 * usable access token for a provider, in priority order:
 *
 *   1. public.social_accounts row (captured by the OAuth callback flow). If the
 *      stored access_token is expired and a refresh_token exists, it is
 *      refreshed against the provider and the new token is persisted.
 *   2. Environment-variable fallback (the names from SOCIAL-AUTOPOSTER-HANDOFF
 *      Section B), so a token pasted straight into Vercel also works.
 *
 * Nothing here posts anything; it only produces credentials for the posters.
 */
import { createServiceClient } from '@/lib/supabase/server';
import type { Provider, SocialAccount } from './types';

export interface ResolvedCreds {
  accessToken: string;
  accountRef: Record<string, string>;
  account?: SocialAccount;
}

async function loadAccount(provider: Provider): Promise<SocialAccount | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('provider', provider)
    .maybeSingle();
  return (data as SocialAccount | null) ?? null;
}

async function persistToken(
  provider: Provider,
  accessToken: string,
  expiresInSec: number | null,
): Promise<void> {
  const supabase = await createServiceClient();
  await supabase
    .from('social_accounts')
    .update({
      access_token: accessToken,
      expires_at: expiresInSec
        ? new Date(Date.now() + expiresInSec * 1000).toISOString()
        : null,
    })
    .eq('provider', provider);
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false; // unknown -> assume caller will handle 401
  // refresh 2 minutes early
  return new Date(expiresAt).getTime() - Date.now() < 120_000;
}

/**
 * OAuth2 refresh-token grant using HTTP Basic client authentication. X and
 * Pinterest require Basic auth for confidential clients; Google accepts it too.
 * Returns the new access token + lifetime.
 */
async function refreshOAuth2(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number | null }> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.access_token) {
    throw new Error(
      `token refresh failed (${res.status}): ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  return {
    accessToken: String(json.access_token),
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : null,
  };
}

const REFRESH_ENDPOINTS: Partial<Record<Provider, string>> = {
  x: 'https://api.twitter.com/2/oauth2/token',
  google: 'https://oauth2.googleapis.com/token',
  pinterest: 'https://api.pinterest.com/v5/oauth/token',
};

function clientCreds(provider: Provider): { id: string; secret: string } | null {
  const map: Record<Provider, [string, string]> = {
    x: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
    google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    meta: ['META_APP_ID', 'META_APP_SECRET'],
    pinterest: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET'],
    tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
  };
  const [idKey, secretKey] = map[provider];
  const id = process.env[idKey];
  const secret = process.env[secretKey];
  return id && secret ? { id, secret } : null;
}

/** Env-var fallbacks matching SOCIAL-AUTOPOSTER-HANDOFF Section B. */
function envFallback(provider: Provider): ResolvedCreds | null {
  switch (provider) {
    case 'meta': {
      const token = process.env.META_PAGE_TOKEN;
      if (!token) return null;
      return {
        accessToken: token,
        accountRef: {
          page_id: process.env.META_PAGE_ID ?? '',
          ig_business_id: process.env.IG_BUSINESS_ID ?? '',
        },
      };
    }
    case 'pinterest': {
      // A raw access token may be provided directly; otherwise refresh below.
      const token = process.env.PINTEREST_ACCESS_TOKEN;
      if (!token) return null;
      return {
        accessToken: token,
        accountRef: { board_id: process.env.PINTEREST_BOARD_ID ?? '' },
      };
    }
    default:
      return null;
  }
}

/**
 * Resolve a usable access token + account ids for a provider. Throws a clear
 * error if no credentials are configured (so the cron marks the post failed
 * with an actionable message instead of silently dropping it).
 */
export async function resolveCreds(provider: Provider): Promise<ResolvedCreds> {
  const account = await loadAccount(provider);

  // 1) Stored account with a live (or refreshable) token.
  if (account?.access_token && !isExpired(account.expires_at)) {
    return {
      accessToken: account.access_token,
      accountRef: account.account_ref ?? {},
      account,
    };
  }

  // 2) Stored refresh token -> mint a new access token.
  if (account?.refresh_token && REFRESH_ENDPOINTS[provider]) {
    const creds = clientCreds(provider);
    if (!creds) {
      throw new Error(
        `${provider}: refresh token present but client id/secret env vars missing`,
      );
    }
    const { accessToken, expiresIn } = await refreshOAuth2(
      REFRESH_ENDPOINTS[provider]!,
      creds.id,
      creds.secret,
      account.refresh_token,
    );
    await persistToken(provider, accessToken, expiresIn);
    return {
      accessToken,
      accountRef: account.account_ref ?? {},
      account,
    };
  }

  // 3) Env-var refresh tokens (handoff names) with no DB row yet.
  const envRefresh: Partial<Record<Provider, string | undefined>> = {
    x: process.env.X_REFRESH_TOKEN,
    google: process.env.YOUTUBE_REFRESH_TOKEN,
    pinterest: process.env.PINTEREST_REFRESH_TOKEN,
  };
  const rt = envRefresh[provider];
  if (rt && REFRESH_ENDPOINTS[provider]) {
    const creds = clientCreds(provider);
    if (creds) {
      const { accessToken } = await refreshOAuth2(
        REFRESH_ENDPOINTS[provider]!,
        creds.id,
        creds.secret,
        rt,
      );
      const ref: Record<string, string> = {};
      if (provider === 'pinterest' && process.env.PINTEREST_BOARD_ID) {
        ref.board_id = process.env.PINTEREST_BOARD_ID;
      }
      if (provider === 'google' && process.env.YOUTUBE_CHANNEL_ID) {
        ref.channel_id = process.env.YOUTUBE_CHANNEL_ID;
      }
      return { accessToken, accountRef: ref };
    }
  }

  // 4) Direct-token env fallback (meta page token, pinterest access token).
  const fb = envFallback(provider);
  if (fb) return fb;

  throw new Error(
    `${provider}: no credentials. Connect via /api/social/oauth/${provider}/start or set the Section B env vars.`,
  );
}
