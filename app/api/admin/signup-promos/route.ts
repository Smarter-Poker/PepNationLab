export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { normalizePromoCode, sanitizePromoName, resolveRewardValue, promoListWithLive } from '@/lib/signup-promos';

// Admin CRUD for platform-wide signup promo codes (scope = 'platform').
// GET    -> { promos, catalog }
// POST   -> create
// PATCH  -> update { id, ...fields }
// DELETE -> ?id=...

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const supabase = createAdminClient();

  const [{ data: promos }, { data: catalog }] = await Promise.all([
    supabase.from('signup_promo_codes').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('signup_promo_reward_catalog').select('*').eq('is_active', true).order('sort_order'),
  ]);

  return NextResponse.json({ promos: promoListWithLive(promos ?? []), catalog: catalog ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }

  const name = sanitizePromoName(body?.name);
  const code = normalizePromoCode(body?.code);
  const rewardKey = String(body?.reward_key ?? '').trim();
  if (name.length < 2) return NextResponse.json({ error: 'A Promo Name Is Required.' }, { status: 400 });
  if (!code) return NextResponse.json({ error: 'A Valid Promo Code Is Required (2-40 Letters/Numbers).' }, { status: 400 });

  const supabase = createAdminClient();
  const rewardValue = await resolveRewardValue(supabase, rewardKey);
  if (rewardValue === null) return NextResponse.json({ error: 'Please Select A Valid Reward.' }, { status: 400 });

  const { data, error } = await supabase.from('signup_promo_codes').insert({
    code, name, reward_key: rewardKey, reward_value: rewardValue,
    scope: 'platform', owner_agent_id: null,
    is_active: body?.is_active !== false,
    max_uses: Number.isFinite(Number(body?.max_uses)) && Number(body?.max_uses) >= 0 ? Math.trunc(Number(body.max_uses)) : null,
    starts_at: body?.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString(),
    ends_at: body?.ends_at ? new Date(body.ends_at).toISOString() : null,
    created_by: gate.userId,
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
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

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

  const supabase = createAdminClient();
  const { data, error } = await supabase.from('signup_promo_codes').update(patch).eq('id', id).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could Not Update The Promo Code.' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing Promo Id.' }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from('signup_promo_codes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could Not Delete The Promo Code.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
