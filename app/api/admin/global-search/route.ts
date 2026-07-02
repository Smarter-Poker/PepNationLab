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

// fix-49 / fix-52: tokenize on whitespace and strip characters that would
// break PostgREST's `.or()` mini-grammar (it uses commas as separators and
// parentheses for grouping). A token with one of those would silently
// malform the request. Also strip _ and [ to prevent ILIKE wildcards.
function sanitizeToken(t: string): string {
  return t.replace(/[,()*_[\]\\]/g, '').trim();
}

function tokenize(q: string): string[] {
  return q
    .split(/\s+/)
    .map((t) => sanitizeToken(t))
    .filter((t) => t.length >= 2);
}

function buildOrLeg(columns: string[], token: string): string {
  return columns.map((c) => `${c}.ilike.%${token}%`).join(',');
}

// Chain one .or() leg per token so PostgREST AND-joins them. Pass the
// queryBuilder in and out so each caller can keep its own typed builder.
function applyTokenAndOr<T extends { or: (s: string) => T }>(
  builder: T,
  columns: string[],
  tokens: string[],
): T {
  for (const tok of tokens) {
    builder = builder.or(buildOrLeg(columns, tok));
  }
  return builder;
}

function numOrNull(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return adminCheck.response;
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

  // USERS - AND-of-tokens, each token OR-matches across name/username/email
  let usersP: PromiseLike<{ data: Record<string, unknown>[] | null }>;
  if (wants('users') && tokens.length > 0) {
    let builder = svc
      .from('profiles')
      .select('id, full_name, username, email, role, is_super_agent')
      .eq('is_active', true);
    builder = applyTokenAndOr(builder, ['full_name', 'username', 'email'], tokens);
    usersP = builder.limit(limitPer);
  } else {
    usersP = Promise.resolve({ data: [] });
  }

  // PRODUCTS
  let productsP: PromiseLike<{ data: Record<string, unknown>[] | null }>;
  if (wants('products') && tokens.length > 0) {
    let builder = svc.from('products').select('id, name, slug, sku, base_cost, is_active');
    builder = applyTokenAndOr(builder, ['name', 'slug', 'sku'], tokens);
    productsP = builder.limit(limitPer);
  } else {
    productsP = Promise.resolve({ data: [] });
  }

  // STOREFRONTS
  let storefrontsP: PromiseLike<{ data: Record<string, unknown>[] | null }>;
  if (wants('storefronts') && tokens.length > 0) {
    let builder = svc.from('agent_profiles').select('id, slug, display_name, is_active');
    builder = applyTokenAndOr(builder, ['slug', 'display_name'], tokens);
    storefrontsP = builder.limit(limitPer);
  } else {
    storefrontsP = Promise.resolve({ data: [] });
  }

  // ORDERS - RPC owns the search logic (fuzzy + structured filters)
  let ordersP: PromiseLike<{ data: Record<string, unknown>[] | null }>;
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
    }) as unknown as Promise<{ data: Record<string, unknown>[] | null }>;
  } else {
    ordersP = Promise.resolve({ data: [] });
  }

  // COUPONS
  let couponsP: PromiseLike<{ data: Record<string, unknown>[] | null }>;
  if (wants('coupons') && tokens.length > 0) {
    let builder = svc
      .from('coupons')
      .select('id, code, type:discount_type, value:discount_value, agent_id, uses_count, expires_at, is_active');
    builder = applyTokenAndOr(builder, ['code'], tokens);
    couponsP = builder.limit(limitPer);
  } else {
    couponsP = Promise.resolve({ data: [] });
  }

  // TRANSACTIONS
  let transactionsP: PromiseLike<{ data: Record<string, unknown>[] | null }>;
  if (wants('transactions') && tokens.length > 0) {
    let builder = svc
      .from('balance_transactions')
      .select('id, agent_id, amount, type, description, created_at, order_id:reference_id');
    builder = applyTokenAndOr(builder, ['description'], tokens);
    transactionsP = builder.order('created_at', { ascending: false }).limit(limitPer);
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
