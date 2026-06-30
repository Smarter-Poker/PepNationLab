import { NextRequest, NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const [
    { data: variants, error: variantsError },
    { data: reminders, error: remindersError },
  ] = await Promise.all([
    svc.from('cart_recovery_variants').select('id, name, enabled, steps, created_at, updated_at').order('created_at', { ascending: true }),
    svc.from('abandoned_cart_reminders').select('variant_name, recovered_order_id'),
  ]);

  if (variantsError) return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  if (remindersError) return NextResponse.json({ error: 'Database Error' }, { status: 500 });

  const stats = new Map<string, { sent: number; recovered: number }>();
  for (const r of reminders ?? []) {
    const name = (r as any).variant_name as string | null;
    if (!name) continue;
    const cur = stats.get(name) ?? { sent: 0, recovered: 0 };
    cur.sent += 1;
    if ((r as any).recovered_order_id) cur.recovered += 1;
    stats.set(name, cur);
  }

  const out = (variants ?? []).map((v: any) => ({
    id: v.id,
    name: v.name,
    enabled: v.enabled,
    steps: v.steps,
    sent: stats.get(v.name)?.sent ?? 0,
    recovered: stats.get(v.name)?.recovered ?? 0,
    winRate: (() => {
      const s = stats.get(v.name)?.sent ?? 0;
      const r = stats.get(v.name)?.recovered ?? 0;
      return s > 0 ? Math.round((r / s) * 1000) / 10 : 0;
    })(),
  }));

  const res = NextResponse.json({ variants: out });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const name = String(body.name ?? '').trim();
  const steps = Array.isArray(body.steps) ? body.steps : null;
  if (!name || !/^[a-z0-9_-]{2,40}$/i.test(name)) {
    return NextResponse.json({ error: 'Name Must Be 2-40 Chars, Letters/Numbers/Dashes' }, { status: 400 });
  }
  if (!steps || steps.length === 0 || steps.length > 5) {
    return NextResponse.json({ error: 'Steps Must Be 1 To 5 Entries' }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { error } = await svc.from('cart_recovery_variants').insert({ name, steps, enabled: body.enabled !== false });
  if (error) return safeError('cart-recovery-variants.create', error, 500);
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id') || '';
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updates: any = {};
  if (body.enabled !== undefined) updates.enabled = body.enabled === true;
  if (body.steps !== undefined) {
    if (!Array.isArray(body.steps) || body.steps.length === 0 || body.steps.length > 5) {
      return NextResponse.json({ error: 'Steps Must Be 1 To 5 Entries' }, { status: 400 });
    }
    updates.steps = body.steps;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No Changes' }, { status: 400 });

  const svc = await createServiceClient();
  const { error } = await svc.from('cart_recovery_variants').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed To Update' }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id') || '';
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const svc = await createServiceClient();
  const { error } = await svc.from('cart_recovery_variants').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed To Delete' }, { status: 500 });
  return NextResponse.json({ success: true });
}
