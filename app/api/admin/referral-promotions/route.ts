export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

// Admin CRUD for custom referral promotions. A live promotion overrides the
// base referral_settings reward amounts (see apply_referral_code).
// GET    -> list all promotions
// POST   -> create
// PATCH  -> update { id, ...fields }
// DELETE -> ?id=...

function parseAmount(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('referral_promotions')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: 'Could Not Load Promotions.' }, { status: 500 });

  const now = Date.now();
  const rows = (data ?? []).map((p: any) => {
    const started = new Date(p.starts_at).getTime() <= now;
    const ended = p.ends_at ? new Date(p.ends_at).getTime() <= now : false;
    const live = p.is_active && started && !ended;
    return { ...p, live };
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }

  const name = String(body?.name ?? '').trim().slice(0, 120);
  const referrerReward = parseAmount(body?.referrer_reward);
  const refereeReward = parseAmount(body?.referee_reward);
  if (name.length < 2) return NextResponse.json({ error: 'A Promotion Name Is Required.' }, { status: 400 });
  if (referrerReward === null || refereeReward === null) {
    return NextResponse.json({ error: 'Valid Reward Amounts Are Required.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('referral_promotions')
    .insert({
      name,
      referrer_reward: referrerReward,
      referee_reward: refereeReward,
      description: body?.description ? String(body.description).trim().slice(0, 300) : null,
      starts_at: body?.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString(),
      ends_at: body?.ends_at ? new Date(body.ends_at).toISOString() : null,
      is_active: body?.is_active !== false,
      priority: Number.isFinite(Number(body?.priority)) ? Math.trunc(Number(body.priority)) : 0,
      created_by: gate.userId,
    })
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Could Not Create The Promotion.' }, { status: 500 });
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
  if (!id) return NextResponse.json({ error: 'Missing Promotion Id.' }, { status: 400 });

  const patch: Record<string, any> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 120);
  if (body.referrer_reward !== undefined) {
    const a = parseAmount(body.referrer_reward);
    if (a === null) return NextResponse.json({ error: 'Invalid Referrer Reward.' }, { status: 400 });
    patch.referrer_reward = a;
  }
  if (body.referee_reward !== undefined) {
    const a = parseAmount(body.referee_reward);
    if (a === null) return NextResponse.json({ error: 'Invalid Referee Reward.' }, { status: 400 });
    patch.referee_reward = a;
  }
  if (body.description !== undefined) patch.description = body.description ? String(body.description).trim().slice(0, 300) : null;
  if (body.starts_at !== undefined) patch.starts_at = body.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString();
  if (body.ends_at !== undefined) patch.ends_at = body.ends_at ? new Date(body.ends_at).toISOString() : null;
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;
  if (body.priority !== undefined && Number.isFinite(Number(body.priority))) patch.priority = Math.trunc(Number(body.priority));

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing To Update.' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('referral_promotions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Could Not Update The Promotion.' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing Promotion Id.' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('referral_promotions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could Not Delete The Promotion.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
