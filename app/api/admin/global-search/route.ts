import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Scope =
  | 'all'
  | 'users'
  | 'products'
  | 'orders'
  | 'storefronts'
  | 'coupons'
  | 'transactions';

const VALID_SCOPES: Scope[] = ['all', 'users', 'products', 'orders', 'storefronts', 'coupons', 'transactions'];

function isValidScope(v: string | null): v is Scope {
  return !!v && (VALID_SCOPES as string[]).includes(v);
}

// fix-48: rebuilt global admin search.
//   - Adds coupons + transactions entity types.
//   - Honors ?scope=<category> for focused queries with higher per-scope limit.
//   - Returns counts for empty groups so the client can render zero-state per
//     scope chip even when the group has no results.
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
  const scopeRaw = req.nextUrl.searchParams.get('scope');
  const scope: Scope = isValidScope(scopeRaw) ? scopeRaw : 'all';

  if (q.length < 2) {
    return NextResponse.json({
      scope,
      users: [], products: [], orders: [], storefronts: [], coupons: [], transactions: [],
    });
  }
  if (q.length > 100) {
    return NextResponse.json({ error: 'Query Too Long' }, { status: 400 });
  }

  const svc = await createServiceClient();
  const like = `%${q}%`;
  const limitPer = scope === 'all' ? 12 : 50;
  const wants = (s: Scope) => scope === 'all' || scope === s;

  const usersP = wants('users')
    ? svc
        .from('profiles')
        .select('id, full_name, username, email, role, is_super_agent')
        .or(`full_name.ilike.${like},username.ilike.${like},email.ilike.${like}`)
        .eq('is_active', true)
        .limit(limitPer)
    : Promise.resolve({ data: [] as any[] });

  const productsP = wants('products')
    ? svc
        .from('products')
        .select('id, name, slug, sku, base_cost, is_active')
        .or(`name.ilike.${like},slug.ilike.${like},sku.ilike.${like}`)
        .limit(limitPer)
    : Promise.resolve({ data: [] as any[] });

  const storefrontsP = wants('storefronts')
    ? svc
        .from('agent_profiles')
        .select('id, slug, display_name, is_active')
        .or(`slug.ilike.${like},display_name.ilike.${like}`)
        .limit(limitPer)
    : Promise.resolve({ data: [] as any[] });

  let ordersP: Promise<{ data: any[] | null }>;
  if (wants('orders')) {
    const ordersOrParts = [
      `buyer_email.ilike.${like}`,
      `buyer_name.ilike.${like}`,
      `tracking_number.ilike.${like}`,
    ];
    if (/^[0-9a-fA-F-]{8,}$/.test(q)) {
      ordersOrParts.push(`id.eq.${q}`);
    }
    ordersP = svc
      .from('orders')
      .select('id, buyer_email, buyer_name, tracking_number, status, total, created_at, agent_id')
      .or(ordersOrParts.join(','))
      .order('created_at', { ascending: false })
      .limit(limitPer);
  } else {
    ordersP = Promise.resolve({ data: [] });
  }

  const couponsP = wants('coupons')
    ? svc
        .from('coupons')
        .select('id, code, type, value, agent_id, uses_count, expires_at, is_active')
        .ilike('code', like)
        .limit(limitPer)
    : Promise.resolve({ data: [] as any[] });

  let transactionsP: Promise<{ data: any[] | null }>;
  if (wants('transactions')) {
    const txOrParts = [`description.ilike.${like}`];
    if (/^[0-9a-fA-F-]{8,}$/.test(q)) {
      txOrParts.push(`id.eq.${q}`);
      txOrParts.push(`order_id.eq.${q}`);
    }
    transactionsP = svc
      .from('balance_transactions')
      .select('id, agent_id, amount, type, description, created_at, order_id')
      .or(txOrParts.join(','))
      .order('created_at', { ascending: false })
      .limit(limitPer);
  } else {
    transactionsP = Promise.resolve({ data: [] });
  }

  const [
    { data: users },
    { data: products },
    { data: storefronts },
    { data: orders },
    { data: coupons },
    { data: transactions },
  ] = await Promise.all([usersP, productsP, storefrontsP, ordersP, couponsP, transactionsP]);

  const res = NextResponse.json({
    scope,
    users: users ?? [],
    products: products ?? [],
    storefronts: storefronts ?? [],
    orders: orders ?? [],
    coupons: coupons ?? [],
    transactions: transactions ?? [],
  });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}
