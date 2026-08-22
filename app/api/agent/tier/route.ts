import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { isTierLadderV2, getHouseTiers, resolveHouseTierLevel } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/tier
 *
 * House-tier gamification state for the calling agent (Super Agent / standalone).
 * Returns `enabled:false` when the tier-ladder v2 flag is off so the UI hides.
 * Blind-pricing: exposes the agent's own tier + progress only - never upline data.
 */
export async function GET() {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  if (!isTierLadderV2()) {
    return NextResponse.json({ enabled: false });
  }

  const agentId = gate.user.id;
  const svc = await createServiceClient();

  const [{ data: profile }, tiers, level, volRes] = await Promise.all([
    svc.from('profiles').select('fixed_scale_override, locked_tier_level, tier_grace_period_expires_at, parent_agent_id, commission_pct, is_sub_agent').eq('id', agentId).maybeSingle(),
    getHouseTiers(svc),
    resolveHouseTierLevel(svc, agentId),
    svc.rpc('fn_agent_volume_30d', { p_agent: agentId }),
  ]);

  // Chain pricing (2026-07-21): a downline account under a Super Agent
  // (parent_agent_id set) is priced off the chain - this account's assigned
  // commission_pct compounded on top of its parent's cost - NOT the house
  // tier ladder. Showing "Rookie / Level 1" gamification copy here for a
  // chain-priced account is exactly the "auto defaults to Tier 3" complaint;
  // surface the actual markup instead. Top-level accounts (no parent) are
  // unaffected and keep the ladder below. Sub-agents are EXCLUDED even when
  // parented: their commission_pct is a recruiter payout percent (paid by
  // their parent), never a cost markup, so they must keep the ladder/commission
  // behavior below - this guards against them rendering as chain-priced if the
  // commission API fetch ever fails.
  const parentAgentId = (profile as { parent_agent_id?: string | null } | null)?.parent_agent_id ?? null;
  const isSubAgent = (profile as { is_sub_agent?: boolean | null } | null)?.is_sub_agent === true;
  if (parentAgentId && !isSubAgent) {
    const rawCommissionPct = (profile as { commission_pct?: number | null } | null)?.commission_pct;
    const markupIsDefault = rawCommissionPct == null;
    const markupPct = markupIsDefault ? 50 : Number(rawCommissionPct);
    return NextResponse.json({
      enabled: true,
      chainPriced: true,
      markupPct,
      markupIsDefault,
    });
  }

  const volume30 = volRes.error ? 0 : Number(volRes.data ?? 0);
  const current = tiers.find((t) => t.level === level) ?? null;
  const next = tiers.find((t) => t.level === level - 1) ?? null;

  // Progress within the current tier band (top tier = full).
  let progress = 1;
  if (current) {
    if (current.max_volume == null) {
      progress = 1;
    } else {
      const band = current.max_volume - current.min_volume;
      progress = band > 0 ? Math.min(1, Math.max(0, (volume30 - current.min_volume) / band)) : 1;
    }
  }

  const dollarsToNext = next ? Math.max(0, next.min_volume - volume30) : 0;

  return NextResponse.json({
    enabled: true,
    locked: !!profile?.fixed_scale_override,
    level,
    levelName: current?.name ?? 'Rookie',
    volume30: Number(volume30.toFixed(2)),
    progress: Number(progress.toFixed(4)),
    next: next ? { level: next.level, name: next.name, dollarsToNext: Number(dollarsToNext.toFixed(2)) } : null,
    ladder: tiers.map((t) => ({ level: t.level, name: t.name, min_volume: t.min_volume, max_volume: t.max_volume })),
    gracePeriodExpiresAt: profile?.tier_grace_period_expires_at || null,
  });
}
