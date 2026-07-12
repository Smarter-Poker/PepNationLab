export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { normalizePromoCode, sanitizePromoName, resolveRewardValue, promoListWithLive } from '@/lib/signup-promos';

// Super-agent CRUD for their own signup promo codes (scope = 'agent').

async function requireSuperAgent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 }) };
  const svc = await createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('id, role, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();
  const isSuper = !!profile && (profile.role === 'super_agent' || profile.is_super_agent === true || profile.role === 'admin');
  if (!isSuper) return { error: NextResponse.json({ error: 'Forbidden. Super-Agent Access Required.' }, { status: 403 }) };
  return { userId: user.id, svc };
}

export async function GET() {
  const gate = await requireSuperAgent();
  if ('error' in gate) return gate.error;
  const { svc, userId } = gate;
  const [{ data: promos }, { data: catalog }] = await Promise.all([
    svc.from('signup_promo_codes').select('*').eq('owner_agent_id', userId).order('created_at', { ascending: false }).limit(200),
    svc.from('signup_promo_reward_catalog').select('*').eq('is_active', true).order('sort_order'),
  ]);
  return NextResponse.json({ promos: promoListWithLive(promos ?? []), catalog: catalog ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireSuperAgent();
  if ('error' in gate) return gate.error;
  const { svc, userId } = gate;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }
  const name = sanitizePromoName(body?.name);
  const code = normalizePromoCode(body?.code);
  const rewardKey = String(body?.reward_key ?? '').trim();
  if (name.length < 2) return NextResponse.json({ error: 'A Promo Name Is Required.' }, { status: 400 });
  if (!code) return NextResponse.json({ error: 'A Valid Promo Code Is Required (2-40 Letters/Numbers).' }, { status: 400 });

  const rewardValue = await resolveRewardValue(svc, rewardKey);
  if (rewardValue === null) return NextResponse.json({ error: 'Please Select A Valid Reward.' }, { status: 400 });

  const { data, error } = await svc.from('signup_promo_codes').insert({
    code, name, reward_key: rewardKey, reward_value: rewardValue,
    scope: 'agent', owner_agent_id: userId,
    is_active: body?.is_active !== false,
    max_uses: Number.isFinite(Number(body?.max_uses)) && Number(body?.max_uses) >= 0 ? Math.trunc(Number(body.max_uses)) : null,
    starts_at: body?.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString(),
    ends_at: body?.ends_at ? new Date(body.ends_at).toISOString() : null,
    created_by: userId,
  }).select('*').maybeSingle();

  if (error) {
    if ((error as any).code === '23505') return NextResponse.json({ error: 'That Promo Code Already Exists.' }, { status: 409 });
    return NextResponse.json({ error: 'Could Not Create The Promo Code.' }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireSuperAgent();
  if ('error' in gate) return gate.error;
  const { svc, userId } = gate;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'Missing Promo Id.' }, { status: 400 });

  const patch: Record<string, any> = {};
  if (body.name !== undefined) patch.name = sanitizePromoName(body.name);
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;
  if (body.max_uses !== undefined) patch.max_uses = body.max_uses === null || body.max_uses === '' ? null : Math.max(0, Math.trunc(Number(body.max_uses) || 0));
  if (body.ends_at !== undefined) patch.ends_at = body.ends_at ? new Date(body.ends_at).toISOString() : null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing To Update.' }, { status: 400 });

  // Scope the update to the owner's own row.
  const { data, error } = await svc.from('signup_promo_codes').update(patch)
    .eq('id', id).eq('owner_agent_id', userId).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could Not Update The Promo Code.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Promo Code Not Found.' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireSuperAgent();
  if ('error' in gate) return gate.error;
  const { svc, userId } = gate;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing Promo Id.' }, { status: 400 });
  const { error } = await svc.from('signup_promo_codes').delete().eq('id', id).eq('owner_agent_id', userId);
  if (error) return NextResponse.json({ error: 'Could Not Delete The Promo Code.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
