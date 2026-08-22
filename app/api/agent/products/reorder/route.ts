import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

// PUT /api/agent/products/reorder
export async function PUT(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const { order } = body;
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: 'Missing Order Array' }, { status: 400 });
  }
  try {
    const supabase = await createServiceClient();
    const updates = order.map(({ id, sort_order }: { id: string; sort_order: number }) =>
      supabase.from('agent_products').update({ sort_order, updated_at: new Date().toISOString() }).eq('id', id).eq('agent_id', gate.user.id)
    );
    await Promise.all(updates);
    // sort_order drives the public catalog's product ordering - purge the
    // storefront catalog cache so the new arrangement shows immediately.
    try {
      revalidateTag('storefront-catalog', { expire: 0 });
    } catch { /* best-effort cache refresh */ }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[products/reorder] PUT error:', err);
    return NextResponse.json({ error: 'Failed To Update Product Order' }, { status: 500 });
  }
}
