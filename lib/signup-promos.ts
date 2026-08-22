/**
 * Shared helpers for signup promo codes (admin + super-agent creators).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export function normalizePromoCode(v: unknown): string | null {
  const code = String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (code.length < 2 || code.length > 40) return null;
  return code;
}

export function sanitizePromoName(v: unknown): string {
  return String(v ?? '').trim().slice(0, 80);
}

/**
 * Reward value is fixed by the chosen catalog template (admin/super-agent just
 * pick a reward off the list). Returns the template's default_value, or null if
 * the key is not a live catalog reward.
 */
export async function resolveRewardValue(
  supabase: SupabaseClient,
  rewardKey: string,
): Promise<number | null> {
  if (!rewardKey) return null;
  const { data } = await supabase
    .from('signup_promo_reward_catalog')
    .select('default_value, is_active')
    .eq('key', rewardKey)
    .maybeSingle();
  if (!data || data.is_active === false) return null;
  return Number(data.default_value) || 0;
}

/** Annotate promo rows with a computed `live` flag (active + within window). */
export function promoListWithLive<T extends { is_active?: boolean; starts_at?: string; ends_at?: string | null }>(rows: T[]): (T & { live: boolean })[] {
  const now = Date.now();
  return rows.map((p) => {
    const started = p.starts_at ? new Date(p.starts_at).getTime() <= now : true;
    const ended = p.ends_at ? new Date(p.ends_at).getTime() <= now : false;
    return { ...p, live: !!p.is_active && started && !ended };
  });
}
