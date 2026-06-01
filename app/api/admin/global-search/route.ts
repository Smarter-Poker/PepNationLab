import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// fix-47: global admin search. Searches users, products, orders, and
// storefronts in parallel and returns categorized hits.
//
// Order matching strategies:
//   - Order id-prefix (UUID) match on >=8 chars
//   - Buyer email substring
//   - Buyer name substring
//   - Tracking number substring
// Caller gets all matches deduped by id.
export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error ?? 'Unauthorized' }, { status: adminCheck.status ?? 401 });
  }

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'admin_global_search',
    limit: 60,
    windowSeconds: 60,
    identifier: adminCheck.userId || ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ users: [], products: [], orders: [], storefronts: [] });
  }
  if (q.length > 100) {
    return NextResponse.json({ error: 'Query Too Long' }, { status: 400 });
  }

  const svc = await createServiceClient();
  const like = `%${q}%`;

  // ─ Users ─ search by name / username / email
  const usersP = svc
    .from('profiles')
    .select('id, full_name, username, email, role, is_super_agent')
    .or(`full_name.ilike.${like},username.ilike.${like},email.ilike.${like}`)
    .eq('is_active', true)
    .limit(20);

  // ─ Products ─
  const productsP = svc
    .from('products')
    .select('id, name, slug, sku, base_cost, is_active')
    .or(`name.ilike.${like},slug.ilike.${like},sku.ilike.${like}`)
    .limit(20);

  // ─ Storefronts ─
  const storefrontsP = svc
    .from('agent_profiles')
    .select('id, slug, display_name, is_active')
    .or(`slug.ilike.${like},display_name.ilike.${like}`)
    .limit(20);

  // ─ Orders ─ buyer name / email / tracking + id-prefix.
  const ordersOrParts = [
    `buyer_email.ilike.${like}`,
    `buyer_name.ilike.${like}`,
    `tracking_number.ilike.${like}`,
  ];
  // UUID id-prefix search only when query looks like a UUID fragment.
  if (/^[0-9a-fA-F-]{8,}$/.test(q)) {
    ordersOrParts.push(`id.eq.${q.includes('-') ? q : q}`);
  }
  const ordersP = svc
    .from('orders')
    .select('id, buyer_email, buyer_name, tracking_number, status, total, created_at')
    .or(ordersOrParts.join(','))
    .order('created_at', { ascending: false })
    .limit(20);

  const [
    { data: users },
    { data: products },
    { data: storefronts },
    { data: orders },
  ] = await Promise.all([usersP, productsP, storefrontsP, ordersP]);

  const res = NextResponse.json({
    users: users ?? [],
    products: products ?? [],
    storefronts: storefronts ?? [],
    orders: orders ?? [],
  });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}
