import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { isTierLadderV2 } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/commission
 *
 * Sub-agent commission mini-ladder state for the gamification widget:
 * base %, current effective %, cap, this-month retail volume, the milestone
 * steps, and the next milestone. Blind: never exposes the super-agent's
 * wholesale tier or what the upline earns. Returns enabled:false when the flag
 * is off, or applicable:false for non-sub-agents.
 */
export async function GET() {
  try {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  if (!isTierLadderV2()) {
    return NextResponse.json({ enabled: false });
  }

  const agentId = gate.user.id;
  const svc = await createServiceClient();

  const { data: profile } = await svc
    .from('profiles')
    .select('is_sub_agent, commission_pct, commission_max_pct')
    .eq('id', agentId)
    .maybeSingle();

  if (!profile?.is_sub_agent) {
    return NextResponse.json({ enabled: true, applicable: false });
  }

  const [effRes, volRes, planRes, defRes] = await Promise.all([
    svc.rpc('fn_sub_agent_effective_commission', { p_sub: agentId }),
    svc.rpc('fn_sub_agent_month_retail', { p_sub: agentId }),
    svc.from('sub_agent_commission_plan').select('steps').eq('sub_agent_id', agentId).maybeSingle(),
    svc.rpc('fn_house_default_commission_steps'),
  ]);

  const base = Number(profile.commission_pct ?? 0);
  const cap = profile.commission_max_pct == null ? null : Number(profile.commission_max_pct);
  const effective = effRes.error ? base : Number(effRes.data ?? base);
  const monthRetail = volRes.error ? 0 : Number(volRes.data ?? 0);

  const rawSteps = (planRes.data?.steps && Array.isArray(planRes.data.steps) && planRes.data.steps.length > 0)
    ? planRes.data.steps
    : (defRes.data ?? []);
  const steps = (rawSteps as Array<{ min_volume: number; bonus_pct: number }>)
    .map((s) => ({ min_volume: Number(s.min_volume), bonus_pct: Number(s.bonus_pct) }))
    .sort((a, b) => a.min_volume - b.min_volume);

  const next = steps.find((s) => monthRetail < s.min_volume) ?? null;

  return NextResponse.json({
    enabled: true,
    applicable: true,
    base_pct: base,
    cap_pct: cap,
    effective_pct: effective,
    month_retail: Number(monthRetail.toFixed(2)),
    steps,
    next: next ? { min_volume: next.min_volume, bonus_pct: next.bonus_pct, dollarsToNext: Number(Math.max(0, next.min_volume - monthRetail).toFixed(2)) } : null,
  });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
