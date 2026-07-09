/**
 * Server-only read helpers for the social autoposter admin console.
 *
 * Shared by the admin API routes (/api/admin/social/*) and the server-rendered
 * console page, so the "what does the admin get to see" logic lives in exactly
 * one place. Token VALUES never leave this module - only booleans and
 * whitelisted, non-secret ids.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { isAutopostEnabled } from './index';
import type { Provider } from './types';

export const PROVIDERS: Provider[] = ['pinterest', 'google', 'x', 'meta', 'tiktok'];

export const PROVIDER_LABEL: Record<Provider, string> = {
  pinterest: 'Pinterest',
  google: 'YouTube (Google)',
  x: 'X (Twitter)',
  meta: 'Instagram + Facebook (Meta)',
  tiktok: 'TikTok',
};

/**
 * Non-secret keys only. Everything else in account_ref is a credential -
 * notably Meta stores `page_token` there - and must never reach the browser.
 */
const SAFE_REF_KEYS = ['page_id', 'ig_business_id', 'board_id', 'channel_id'];

export const QUEUE_STATUSES = ['pending', 'posting', 'posted', 'failed', 'blocked'] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

const QUEUE_COLUMNS =
  'id, platform, media_url, media_type, caption, link, scheduled_for, status, attempts, ' +
  'compliance_checked, compliance_notes, posted_at, platform_post_id, platform_url, error, source, created_at';

export interface SafeAccount {
  provider: Provider;
  label: string;
  connected: boolean;
  displayLabel: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  canRefresh: boolean;
  scope: string | null;
  accountRef: Record<string, string>;
}

export interface SocialStatus {
  enabled: boolean;
  accounts: SafeAccount[];
  counts: Record<string, number>;
  total: number;
}

interface AccountRow {
  provider: Provider;
  display_label: string | null;
  connected_at: string | null;
  expires_at: string | null;
  scope: string | null;
  account_ref: Record<string, string> | null;
  access_token: string | null;
  refresh_token: string | null;
}

/** Connection state per provider + queue counts. Never returns token values. */
export async function getSocialStatus(): Promise<SocialStatus> {
  const supabase = await createServiceClient();

  const { data: rows } = await supabase
    .from('social_accounts')
    .select('provider, display_label, connected_at, expires_at, scope, account_ref, access_token, refresh_token');

  const byProvider = new Map<string, AccountRow>();
  for (const r of (rows ?? []) as AccountRow[]) byProvider.set(r.provider, r);

  const accounts: SafeAccount[] = PROVIDERS.map((p) => {
    const r = byProvider.get(p);
    const ref: Record<string, string> = {};
    if (r?.account_ref) {
      for (const key of SAFE_REF_KEYS) {
        const v = r.account_ref[key];
        if (v) ref[key] = v;
      }
    }
    const expiresAt = r?.expires_at ?? null;
    return {
      provider: p,
      label: PROVIDER_LABEL[p],
      connected: Boolean(r && (r.access_token || r.refresh_token)),
      displayLabel: r?.display_label ?? null,
      connectedAt: r?.connected_at ?? null,
      expiresAt,
      expired: expiresAt ? new Date(expiresAt).getTime() < Date.now() : false,
      canRefresh: Boolean(r?.refresh_token),
      scope: r?.scope ?? null,
      accountRef: ref,
    };
  });

  const { data: statusRows } = await supabase.from('social_posts').select('status');
  const counts: Record<string, number> = { pending: 0, posting: 0, posted: 0, failed: 0, blocked: 0 };
  for (const row of (statusRows ?? []) as { status: string }[]) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }

  return {
    enabled: isAutopostEnabled(),
    accounts,
    counts,
    total: (statusRows ?? []).length,
  };
}

/** Recent queue rows, newest-scheduled first. Non-secret columns only. */
export async function getSocialQueue(
  status?: string | null,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  const supabase = await createServiceClient();
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;

  let query = supabase
    .from('social_posts')
    .select(QUEUE_COLUMNS)
    .order('scheduled_for', { ascending: false })
    .limit(safeLimit);

  if (status && (QUEUE_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }

  const { data } = await query;
  return (data ?? []) as unknown as Record<string, unknown>[];
}
