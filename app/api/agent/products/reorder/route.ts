import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

// PUT /api/agent/products/reorder
// Bulk update sort_order for an agent's products
export async function PUT(req: NextRequest) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const { order } = body;

  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: 'Missing Order Array' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Bulk update sort_order for each product
  const updates = order.map(({ id, sort_order }: { id: string; sort_order: number }) =>
    supabase
      .from('agent_products')
      .update({ sort_order, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('agent_id', gate.user.id)
  );

  await Promise.all(updates);

  return NextResponse.json({ success: true });
}
