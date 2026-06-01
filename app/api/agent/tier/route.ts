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
 * Blind-pricing: exposes the agent's own tier + progress only — never upline data.
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
    svc.from('profiles').select('fixed_scale_override, locked_tier_level').eq('id', agentId).maybeSingle(),
    getHouseTiers(svc),
    resolveHouseTierLevel(svc, agentId),
    svc.rpc('fn_agent_volume_30d', { p_agent: agentId }),
  ]);

  const volume30 = volRes.error ? 0 : Number(volRes.data ?? 0);
  const current = tiers.find((t) => t.level === level) ?? null;
  const next = tiers.find((t) => t.level === level + 1) ?? null;

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
  });
}
