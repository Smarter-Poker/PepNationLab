import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Scope = 'all' | 'users' | 'products' | 'orders' | 'storefronts' | 'coupons' | 'transactions';

const VALID_SCOPES: Scope[] = ['all', 'users', 'products', 'orders', 'storefronts', 'coupons', 'transactions'];

function isValidScope(v: string | null): v is Scope {
  return !!v && (VALID_SCOPES as string[]).includes(v);
}

// fix-49: token-split. "john smith" → ["john", "smith"]. ANY token matching
// ANY column counts as a hit — the pg_trgm GIN indexes added in the
// companion migration make this scale even with leading wildcards.
function tokenize(q: string): string[] {
  return q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function multiTokenOr(columns: string[], tokens: string[]): string {
  const parts: string[] = [];
  for (const tok of tokens) {
    const like = `%${tok}%`;
    for (const col of columns) {
      parts.push(`${col}.ilike.${like}`);
    }
  }
  return parts.join(',');
}

function numOrNull(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim();
  const scopeRaw = sp.get('scope');
  const scope: Scope = isValidScope(scopeRaw) ? scopeRaw : 'all';

  // Order-specific structured filters — only apply to the orders RPC.
  const filterStatus      = sp.get('status') || null;
  const filterPayment     = sp.get('payment') || null;
  const filterDateFrom    = sp.get('from') || null;
  const filterDateTo      = sp.get('to') || null;
  const filterMinTotal    = numOrNull(sp.get('min'));
  const filterMaxTotal    = numOrNull(sp.get('max'));
  const filterAgentId     = sp.get('agent') || null;

  const hasOrderFilters = !!(
    filterStatus || filterPayment || filterDateFrom || filterDateTo ||
    filterMinTotal != null || filterMaxTotal != null || filterAgentId
  );

  if (q.length < 2 && !hasOrderFilters) {
    return NextResponse.json({
      scope,
      users: [], products: [], orders: [], storefronts: [],
      coupons: [], transactions: [],
    });
  }
  if (q.length > 100) {
    return NextResponse.json({ error: 'Query Too Long' }, { status: 400 });
  }

  const svc = await createServiceClient();
  const limitPer = scope === 'all' ? 12 : 50;
  const wants = (s: Scope) => scope === 'all' || scope === s;
  const tokens = q.length >= 2 ? tokenize(q) : [];

  // USERS
  let usersP: Promise<{ data: any[] | null }>;
  if (wants('users') && tokens.length > 0) {
    const orStr = multiTokenOr(['full_name', 'username', 'email'], tokens);
    usersP = svc
      .from('profiles')
      .select('id, full_name, username, email, role, is_super_agent')
      .or(orStr)
      .eq('is_active', true)
      .limit(limitPer);
  } else {
    usersP = Promise.resolve({ data: [] });
  }

  // PRODUCTS
  let productsP: Promise<{ data: any[] | null }>;
  if (wants('products') && tokens.length > 0) {
    const orStr = multiTokenOr(['name', 'slug', 'sku'], tokens);
    productsP = svc
      .from('products')
      .select('id, name, slug, sku, base_cost, is_active')
      .or(orStr)
      .limit(limitPer);
  } else {
    productsP = Promise.resolve({ data: [] });
  }

  // STOREFRONTS
  let storefrontsP: Promise<{ data: any[] | null }>;
  if (wants('storefronts') && tokens.length > 0) {
    const orStr = multiTokenOr(['slug', 'display_name'], tokens);
    storefrontsP = svc
      .from('agent_profiles')
      .select('id, slug, display_name, is_active')
      .or(orStr)
      .limit(limitPer);
  } else {
    storefrontsP = Promise.resolve({ data: [] });
  }

  // ORDERS — RPC for fuzzy + structured filters.
  let ordersP: Promise<{ data: any[] | null }>;
  if (wants('orders') && (tokens.length > 0 || hasOrderFilters)) {
    ordersP = svc.rpc('fn_admin_search_orders', {
      p_query: q.length >= 2 ? q : null,
      p_status: filterStatus,
      p_payment_method: filterPayment,
      p_agent_id: filterAgentId,
      p_date_from: filterDateFrom,
      p_date_to: filterDateTo,
      p_min_total: filterMinTotal,
      p_max_total: filterMaxTotal,
      p_limit: limitPer,
    }) as unknown as Promise<{ data: any[] | null }>;
  } else {
    ordersP = Promise.resolve({ data: [] });
  }

  // COUPONS
  let couponsP: Promise<{ data: any[] | null }>;
  if (wants('coupons') && tokens.length > 0) {
    const orStr = multiTokenOr(['code'], tokens);
    couponsP = svc
      .from('coupons')
      .select('id, code, type, value, agent_id, uses_count, expires_at, is_active')
      .or(orStr)
      .limit(limitPer);
  } else {
    couponsP = Promise.resolve({ data: [] });
  }

  // TRANSACTIONS
  let transactionsP: Promise<{ data: any[] | null }>;
  if (wants('transactions') && tokens.length > 0) {
    const orStr = multiTokenOr(['description'], tokens);
    transactionsP = svc
      .from('balance_transactions')
      .select('id, agent_id, amount, type, description, created_at, order_id')
      .or(orStr)
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
