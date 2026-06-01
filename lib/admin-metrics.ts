import { createServiceClient } from '@/lib/supabase/server';

/**
 * Admin Overview KPI metrics. All queries hit the service-role client and
 * run in parallel where possible. Numbers are typed loosely because Supabase
 * count queries return `count: number | null` and we coerce to 0 at call sites.
 */

export interface DashboardMetrics {
  gmvToday: number;
  gmvLast7: number;
  gmvPrior7: number;
  pendingAdminApproval: number;
  pendingAgentApproval: number;
  readyToShip: number;
  readyForPickup: number;
  awaitingTracking: number;
  lowStockCount: number;
  lowStockList: Array<{ id: string; name: string; inventory_count: number; low_stock_threshold: number }>;
  outOfStockCount: number;
  unpaidStatementsCount: number;
  unpaidStatementsTotal: number;
  unreadAdminMessages: number;
  newResearchers24h: number;
  activeAgents: number;
  sparkline: Array<{ date: string; revenue: number }>;
  topSkus: Array<{ name: string; quantity: number; revenue: number }>;
  auditLog: Array<{
    id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
    actor_name: string | null;
    actor_email: string | null;
  }>;
}

export async function fetchAdminMetrics(adminUserId: string): Promise<DashboardMetrics> {
  const supabase = await createServiceClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const days7Ago = new Date(now.getTime() - 7 * 86400000).toISOString();
  const days14Ago = new Date(now.getTime() - 14 * 86400000).toISOString();
  const days30Ago = new Date(now.getTime() - 30 * 86400000).toISOString();
  const day1Ago = new Date(now.getTime() - 86400000).toISOString();

  const NON_GMV_STATUSES = ['pending_customer_payment', 'cancelled'];

  const [
    gmvTodayRes,
    gmvLast7Res,
    gmvPrior7Res,
    pendingAdminApprovalRes,
    pendingAgentApprovalRes,
    readyToShipRes,
    readyForPickupRes,
    awaitingTrackingRes,
    lowStockListRes,
    outOfStockRes,
    unpaidStatementsRes,
    unreadMsgsRes,
    newResearchersRes,
    activeAgentsRes,
    sparklineRes,
    auditLogRes,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('total')
      .gte('created_at', todayStart)
      .eq('is_wholesale_restock', false)
      .not('status', 'in', `(${NON_GMV_STATUSES.join(',')})`),
    supabase
      .from('orders')
      .select('total')
      .gte('created_at', days7Ago)
      .eq('is_wholesale_restock', false)
      .not('status', 'in', `(${NON_GMV_STATUSES.join(',')})`),
    supabase
      .from('orders')
      .select('total')
      .gte('created_at', days14Ago)
      .lt('created_at', days7Ago)
      .eq('is_wholesale_restock', false)
      .not('status', 'in', `(${NON_GMV_STATUSES.join(',')})`),
    // Only count pending_customer_payment and agent_approval_pending for direct orders (where admin is responsible),
    // because external agent orders are filtered out in the admin orders view.
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending_customer_payment').or(`agent_id.is.null,agent_id.eq.${adminUserId}`),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'agent_approval_pending').or(`agent_id.is.null,agent_id.eq.${adminUserId}`),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'approved_ship'),
    // Agent-approved pickup orders awaiting admin fulfillment. Previously these
    // were surfaced nowhere on the admin dashboard (only approved_ship had a
    // tile/metric), so agent-approved pickup orders appeared "missing" to admins.
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'approved_pickup'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'in_fulfillment'),
    supabase
      .from('products')
      .select('id, name, inventory_count, low_stock_threshold')
      .eq('is_active', true)
      .gt('inventory_count', 0)
      .order('inventory_count', { ascending: true })
      .limit(5),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('inventory_count', 0),
    supabase
      .from('weekly_statements')
      .select('total_owed')
      .eq('status', 'pending_payment'),
    supabase
      .from('internal_messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', adminUserId)
      .eq('is_read', false),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'researcher')
      .gte('created_at', day1Ago),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('role', ['agent', 'super_agent'])
      .eq('is_active', true),
    supabase
      .from('orders')
      .select('created_at, total')
      .gte('created_at', days30Ago)
      .eq('is_wholesale_restock', false)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true }),
    supabase
      .from('admin_audit_log')
      .select('id, action, entity_type, entity_id, created_at, actor_id, profiles!admin_audit_log_actor_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  // Two-step topSkus query: fetch qualifying order IDs first, then get order_items
  // for those orders. This avoids relying on PostgREST embedded resource filters
  // (.gte('orders.created_at', ...)) which are version-dependent and may be
  // silently ignored — returning all-time data instead of the last 30 days.
  const { data: recentOrderRows } = await supabase
    .from('orders')
    .select('id')
    .gte('created_at', days30Ago)
    .neq('status', 'cancelled')
    .eq('is_wholesale_restock', false);
  const recentOrderIds = (recentOrderRows ?? []).map((r: { id: string }) => r.id);
  let topSkusData: any[] = [];
  if (recentOrderIds.length > 0) {
    const { data: skuRows } = await supabase
      .from('order_items')
      .select('product_name, quantity, unit_retail_price')
      .in('order_id', recentOrderIds);
    topSkusData = skuRows ?? [];
  }

  const sumTotal = (rows: { total: number | string | null }[] | null | undefined): number => {
    if (!rows || rows.length === 0) return 0;
    return rows.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
  };

  const gmvToday = sumTotal(gmvTodayRes.data);
  const gmvLast7 = sumTotal(gmvLast7Res.data);
  const gmvPrior7 = sumTotal(gmvPrior7Res.data);

  const lowStockList = (lowStockListRes.data || []).filter(
    // Use a sensible default threshold of 10 for products without one configured.
    // Defaulting to 0 would mean products with null threshold never appear as low-stock
    // even when down to a single unit.
    (p: any) => Number(p.inventory_count) <= Number(p.low_stock_threshold ?? 10)
  );

  const unpaidStatementsTotal = (unpaidStatementsRes.data || []).reduce(
    (acc: number, s: any) => acc + (Number(s.total_owed) || 0),
    0
  );

  // Group sparkline data by day in JS
  const dailyMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    dailyMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const order of sparklineRes.data || []) {
    const day = (order as any).created_at.slice(0, 10);
    if (dailyMap.has(day)) {
      dailyMap.set(day, (dailyMap.get(day) || 0) + (Number((order as any).total) || 0));
    }
  }
  const sparkline = Array.from(dailyMap.entries()).map(([date, revenue]) => ({
    date: date.slice(5),
    revenue: Math.round(revenue * 100) / 100,
  }));

  // Aggregate top SKUs from the two-step query above
  const skuMap = new Map<string, { quantity: number; revenue: number }>();
  for (const row of topSkusData) {
    if (!row.product_name) continue;
    const existing = skuMap.get(row.product_name) || { quantity: 0, revenue: 0 };
    existing.quantity += Number(row.quantity) || 0;
    // unit_retail_price is stored as per-10-vial-pack price; divide by 10 for per-vial revenue.
    existing.revenue += (Number(row.quantity) || 0) * ((Number(row.unit_retail_price) || 0) / 10);
    skuMap.set(row.product_name, existing);
  }
  const topSkus = Array.from(skuMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const auditLog = ((auditLogRes.data || []) as any[]).map((entry) => {
    const actor = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
    return {
      id: entry.id as string,
      action: entry.action as string,
      entity_type: (entry.entity_type ?? null) as string | null,
      entity_id: (entry.entity_id ?? null) as string | null,
      created_at: entry.created_at as string,
      actor_name: (actor?.full_name ?? null) as string | null,
      actor_email: (actor?.email ?? null) as string | null,
    };
  });

  return {
    gmvToday,
    gmvLast7,
    gmvPrior7,
    pendingAdminApproval: pendingAdminApprovalRes.count ?? 0,
    pendingAgentApproval: pendingAgentApprovalRes.count ?? 0,
    readyToShip: readyToShipRes.count ?? 0,
    readyForPickup: readyForPickupRes.count ?? 0,
    awaitingTracking: awaitingTrackingRes.count ?? 0,
    lowStockCount: lowStockList.length,
    lowStockList,
    outOfStockCount: outOfStockRes.count ?? 0,
    unpaidStatementsCount: (unpaidStatementsRes.data || []).length,
    unpaidStatementsTotal,
    unreadAdminMessages: unreadMsgsRes.count ?? 0,
    newResearchers24h: newResearchersRes.count ?? 0,
    activeAgents: activeAgentsRes.count ?? 0,
    sparkline,
    topSkus,
    auditLog,
  };
}

export function computeGmvDelta(last7: number, prior7: number): { pct: number; direction: 'up' | 'down' | 'flat' } {
  if (prior7 === 0) {
    if (last7 === 0) return { pct: 0, direction: 'flat' };
    return { pct: 100, direction: 'up' };
  }
  const pct = ((last7 - prior7) / prior7) * 100;
  if (Math.abs(pct) < 0.5) return { pct: 0, direction: 'flat' };
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : 'down' };
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just Now';
  if (minutes < 60) return `${minutes} Minute${minutes === 1 ? '' : 's'} Ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Hour${hours === 1 ? '' : 's'} Ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} Day${days === 1 ? '' : 's'} Ago`;
  return new Date(iso).toLocaleDateString();
}
