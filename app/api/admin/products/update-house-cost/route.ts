import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidateTag } from 'next/cache';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { product_ids: string[], new_value: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { product_ids, new_value } = body;
  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return NextResponse.json({ error: 'Missing product_ids' }, { status: 400 });
  }
  if (typeof new_value !== 'number' || new_value < 0) {
    return NextResponse.json({ error: 'Invalid new_value' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from('products')
    .update({ house_cost: new_value })
    .in('id', product_ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Record an audit log
  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'update_house_cost',
    entity_type: 'product',
    entity_id: product_ids[0],
    changes: { product_ids, new_value }
  });

  try {
    revalidateTag('storefront-catalog');
  } catch {}

  return NextResponse.json({ success: true });
}
