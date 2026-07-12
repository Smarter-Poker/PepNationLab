export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * GET/POST /api/agent/referral-reward
 *
 * The per-account opt-in referral reward (default OFF / 0). Only sub-agents earn
 * a referral credit for signups made with their code; agents and super-agents get
 * downline assignment (no credit), and researchers use the platform referral
 * program. So this endpoint is meaningful for sub-agents, but we let any
 * agent-tier account read/manage their own row without leaking others' data.
 */
async function loadProfile() {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 }) };
  const svc = await createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('id, role, is_sub_agent, is_super_agent, referral_reward_enabled, referral_reward_amount')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return { error: NextResponse.json({ error: 'Profile Not Found.' }, { status: 404 }) };
  const isAgentTier = profile.role === 'agent' || profile.role === 'super_agent'
    || !!profile.is_sub_agent || !!profile.is_super_agent;
  if (!isAgentTier) return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) };
  return { user, svc, profile };
}

export async function GET() {
  const ctx = await loadProfile();
  if ('error' in ctx) return ctx.error;
  const { profile } = ctx;
  return NextResponse.json({
    isSubAgent: !!profile.is_sub_agent,
    enabled: !!profile.referral_reward_enabled,
    amount: Number(profile.referral_reward_amount ?? 0),
  });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const ctx = await loadProfile();
  if ('error' in ctx) return ctx.error;
  const { user, svc } = ctx;

  let body: { enabled?: unknown; amount?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }

  const enabled = body?.enabled === true;
  let amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount < 0) amount = 0;
  amount = Math.min(amount, 1000); // sane per-signup cap
  // Enforce the "off => 0" invariant so a disabled reward never pays out.
  if (!enabled) amount = 0;

  const { error } = await svc
    .from('profiles')
    .update({ referral_reward_enabled: enabled, referral_reward_amount: amount, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: 'Could Not Save Your Referral Reward Setting.' }, { status: 500 });

  return NextResponse.json({ ok: true, enabled, amount });
}
