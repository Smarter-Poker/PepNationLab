import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Super-agent commission-plan editor for a single sub-agent.
 *
 * GET  ?subAgentId=...  -> current base %, cap %, velocity cap, milestone steps,
 *                          and the house default steps (for the editor to seed).
 * POST { subAgentId, basePct, capPct, velocityCap, steps:[{min_volume,bonus_pct}] }
 *
 * Ownership is enforced: the target must be a sub-agent whose parent_agent_id is
 * the caller. Blind: nothing here exposes the caller's own House wholesale tier.
 * Writing config is harmless when the v2 flag is off (the bonus ladder is only
 * read by fn_sub_agent_effective_commission, and velocity_cap only enforced,
 * when the flag is enabled).
 */

async function assertOwnedSubAgent(svc: Awaited<ReturnType<typeof createServiceClient>>, callerId: string, subAgentId: string) {
  const { data } = await svc
    .from('profiles')
    .select('id, parent_agent_id, is_sub_agent')
    .eq('id', subAgentId)
    .maybeSingle();
  if (!data || data.parent_agent_id !== callerId || data.is_sub_agent !== true) return false;
  return true;
}

export async function GET(req: NextRequest) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const subAgentId = req.nextUrl.searchParams.get('subAgentId') || '';
  if (!subAgentId) return NextResponse.json({ error: 'subAgentId Is Required.' }, { status: 400 });

  const svc = await createServiceClient();
  if (!(await assertOwnedSubAgent(svc, gate.user.id, subAgentId))) {
    return NextResponse.json({ error: 'Not Your Sub-Agent.' }, { status: 403 });
  }

  const [{ data: profile }, { data: plan }, defRes] = await Promise.all([
    svc.from('profiles').select('commission_pct, commission_max_pct, velocity_cap').eq('id', subAgentId).maybeSingle(),
    svc.from('sub_agent_commission_plan').select('steps').eq('sub_agent_id', subAgentId).maybeSingle(),
    svc.rpc('fn_house_default_commission_steps'),
  ]);

  const steps = (plan?.steps && Array.isArray(plan.steps) && plan.steps.length > 0) ? plan.steps : (defRes.data ?? []);

  return NextResponse.json({
    base_pct: profile?.commission_pct == null ? 0 : Number(profile.commission_pct),
    cap_pct: profile?.commission_max_pct == null ? null : Number(profile.commission_max_pct),
    velocity_cap: profile?.velocity_cap == null ? null : Number(profile.velocity_cap),
    steps: (steps as Array<{ min_volume: number; bonus_pct: number }>).map((s) => ({ min_volume: Number(s.min_volume), bonus_pct: Number(s.bonus_pct) })),
    default_steps: defRes.data ?? [],
    using_custom_plan: !!(plan?.steps && Array.isArray(plan.steps) && plan.steps.length > 0),
  });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const subAgentId = typeof body.subAgentId === 'string' ? body.subAgentId : '';
  if (!subAgentId) return NextResponse.json({ error: 'subAgentId Is Required.' }, { status: 400 });

  const svc = await createServiceClient();
  if (!(await assertOwnedSubAgent(svc, gate.user.id, subAgentId))) {
    return NextResponse.json({ error: 'Not Your Sub-Agent.' }, { status: 403 });
  }

  // ---- validate numeric config ----
  const basePct = body.basePct == null ? 0 : Number(body.basePct);
  if (!Number.isFinite(basePct) || basePct < 0 || basePct > 100) {
    return NextResponse.json({ error: 'Base Commission Must Be Between 0 And 100.' }, { status: 400 });
  }
  let capPct: number | null = null;
  if (body.capPct != null && body.capPct !== '') {
    capPct = Number(body.capPct);
    if (!Number.isFinite(capPct) || capPct < 0 || capPct > 100) {
      return NextResponse.json({ error: 'Max Commission Cap Must Be Between 0 And 100.' }, { status: 400 });
    }
    if (capPct < basePct) {
      return NextResponse.json({ error: 'Max Commission Cap Cannot Be Below The Base Rate.' }, { status: 400 });
    }
  }
  let velocityCap: number | null = null;
  if (body.velocityCap != null && body.velocityCap !== '') {
    velocityCap = Number(body.velocityCap);
    if (!Number.isFinite(velocityCap) || velocityCap < 0) {
      return NextResponse.json({ error: 'Velocity Cap Must Be Zero Or Greater.' }, { status: 400 });
    }
  }

  // ---- validate + normalize steps ----
  const steps: Array<{ min_volume: number; bonus_pct: number }> = [];
  if (Array.isArray(body.steps)) {
    for (const raw of body.steps) {
      const mv = Number(raw?.min_volume);
      const bp = Number(raw?.bonus_pct);
      if (!Number.isFinite(mv) || mv < 0) return NextResponse.json({ error: 'Each Milestone Needs A Volume Of Zero Or Greater.' }, { status: 400 });
      if (!Number.isFinite(bp) || bp < 0 || bp > 100) return NextResponse.json({ error: 'Each Milestone Bonus Must Be Between 0 And 100.' }, { status: 400 });
      steps.push({ min_volume: mv, bonus_pct: bp });
    }
    steps.sort((a, b) => a.min_volume - b.min_volume);
  }

  // ---- persist ----
  const { error: planErr } = await svc.from('sub_agent_commission_plan').upsert({
    sub_agent_id: subAgentId,
    super_agent_id: gate.user.id,
    steps,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'sub_agent_id' });
  if (planErr) {
    console.error('[commission-plan] plan upsert error:', planErr.message);
    return NextResponse.json({ error: 'Failed To Save Commission Plan.' }, { status: 500 });
  }

  const { error: profErr } = await svc.from('profiles').update({
    commission_pct: basePct,
    commission_max_pct: capPct,
    velocity_cap: velocityCap,
  }).eq('id', subAgentId);
  if (profErr) {
    console.error('[commission-plan] profile update error:', profErr.message);
    return NextResponse.json({ error: 'Failed To Save Sub-Agent Rates.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
