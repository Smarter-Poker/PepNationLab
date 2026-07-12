import { z } from "zod";
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


const PATCHBodySchema = z.any();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  
  
  const __rawBody = await req.json().catch(() => ({}));
  const __bodyParse = PATCHBodySchema.safeParse(__rawBody);
  if (!__bodyParse.success) {
    return NextResponse.json({ error: "Invalid Request Body", details: __bodyParse.error.issues }, { status: 400 });
  }
  const body = __bodyParse.data;


  const updates: any = {};
  if (body.is_active !== undefined) updates.is_active = body.is_active === true;
  if (body.banner_text !== undefined) updates.banner_text = String(body.banner_text).trim() || null;
  if (body.discount_pct !== undefined) {
    const d = Number(body.discount_pct);
    if (!Number.isFinite(d) || d < 0 || d > 90) return NextResponse.json({ error: 'Discount Must Be 0-90' }, { status: 400 });
    updates.discount_pct = d;
  }
  if (body.starts_at !== undefined) updates.starts_at = new Date(String(body.starts_at)).toISOString();
  if (body.ends_at !== undefined) updates.ends_at = new Date(String(body.ends_at)).toISOString();
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No Changes' }, { status: 400 });

  const svc = await createServiceClient();
  const { error } = await svc.from('flash_sales').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed To Update' }, { status: 500 });

  // Activation / discount / window edits change displayed pricing - purge
  // the public storefront catalog cache.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
  } catch { /* best-effort cache refresh */ }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const svc = await createServiceClient();
  const { error } = await svc.from('flash_sales').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed To Delete' }, { status: 500 });

  // Deleting an active sale restores regular pricing - purge the public
  // storefront catalog cache.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
  } catch { /* best-effort cache refresh */ }

  return NextResponse.json({ success: true });
}
