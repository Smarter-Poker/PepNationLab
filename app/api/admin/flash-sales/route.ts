import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from('flash_sales')
    .select('id, name, banner_text, discount_pct, starts_at, ends_at, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: 'Failed To Load' }, { status: 500 });

  const res = NextResponse.json({ sales: data ?? [] });
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
  const bannerText = body.banner_text ? String(body.banner_text).trim() : null;
  const discountPct = Number(body.discount_pct);
  const startsAt = body.starts_at ? new Date(String(body.starts_at)) : new Date();
  const endsAt = body.ends_at ? new Date(String(body.ends_at)) : null;

  if (!name || name.length > 120) return NextResponse.json({ error: 'Name Required (1-120 chars)' }, { status: 400 });
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 90) {
    return NextResponse.json({ error: 'Discount Must Be 0-90' }, { status: 400 });
  }
  if (!endsAt || isNaN(endsAt.getTime())) return NextResponse.json({ error: 'ends_at Required' }, { status: 400 });
  if (endsAt <= startsAt) return NextResponse.json({ error: 'ends_at Must Be After starts_at' }, { status: 400 });

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from('flash_sales')
    .insert({
      name,
      banner_text: bannerText,
      discount_pct: discountPct,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      is_active: body.is_active === true,
      created_by: admin.userId,
    })
    .select('id')
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message || 'Failed To Create' }, { status: 500 });
  return NextResponse.json({ id: data.id, success: true });
}
