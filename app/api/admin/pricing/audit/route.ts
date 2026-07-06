import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pricing/audit
 * Fetches the most recent price changes across the platform.
 * Supports pagination via ?limit and ?offset.
 */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const agentId = url.searchParams.get('agentId');
    const productId = url.searchParams.get('productId');

    const svc = await createServiceClient();

    let query = svc
      .from('price_audit_logs')
      .select(`
        id, old_retail_price, new_retail_price, old_margin_percent, new_margin_percent, reason, created_at,
        profiles (id, email, first_name, last_name, role),
        products (id, name, base_cost, slug)
      `, { count: 'exact' });

    if (agentId) query = query.eq('agent_id', agentId);
    if (productId) query = query.eq('product_id', productId);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Audit log query error:', error);
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    return NextResponse.json({
      logs: data,
      count: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[admin/pricing/audit] error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
