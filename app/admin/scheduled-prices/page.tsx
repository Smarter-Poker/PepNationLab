import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const SCOPE_LABELS: Record<string, string> = {
  master_base_cost: 'Master Base Cost',
  master_bulk_price: 'Master Bulk Price',
  agent_retail: 'Agent Retail',
  tier_multiplier: 'Tier Multiplier',
  product_tier_override: 'Product Tier Override',
};

const ADJUSTMENT_LABELS: Record<string, string> = {
  set: 'Set To',
  percent_delta: 'Percent Delta',
  flat_delta: 'Flat Delta',
};

function formatStatus(row: { applied_at: string | null; failed_at: string | null }): {
  label: string;
  color: string;
} {
  if (row.applied_at) return { label: 'Applied', color: '#68D391' };
  if (row.failed_at) return { label: 'Failed', color: 'var(--red)' };
  return { label: 'Pending', color: '#F6AD55' };
}

function formatValue(adjustment: string, value: number): string {
  if (adjustment === 'percent_delta') {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value}%`;
  }
  if (adjustment === 'flat_delta') {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value}`;
  }
  return String(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type SearchParams = Promise<{ scope?: string; status?: string }>;

export default async function ScheduledPricesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const scopeFilter = typeof params.scope === 'string' ? params.scope : 'all';
  const statusFilter = typeof params.status === 'string' ? params.status : 'all';

  let query = supabase
    .from('scheduled_price_changes')
    .select(
      'id, scope, effective_at, applied_at, failed_at, failure_reason, product_id, agent_product_id, tier_name, adjustment_type, new_value, notes, created_at'
    )
    .order('effective_at', { ascending: false })
    .limit(500);

  if (scopeFilter !== 'all' && SCOPE_LABELS[scopeFilter]) {
    query = query.eq('scope', scopeFilter);
  }
  if (statusFilter === 'pending') {
    query = query.is('applied_at', null).is('failed_at', null);
  } else if (statusFilter === 'applied') {
    query = query.not('applied_at', 'is', null);
  } else if (statusFilter === 'failed') {
    query = query.not('failed_at', 'is', null);
  }

  const { data: rows } = await query;

  const productIds = new Set<string>();
  const agentProductIds = new Set<string>();
  (rows ?? []).forEach((r) => {
    if (r.product_id) productIds.add(r.product_id as string);
    if (r.agent_product_id) agentProductIds.add(r.agent_product_id as string);
  });

  const productLabels: Record<string, string> = {};
  if (productIds.size > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', Array.from(productIds));
    products?.forEach((p) => {
      productLabels[p.id as string] = (p.name as string) ?? (p.id as string);
    });
  }
  const agentProductLabels: Record<string, string> = {};
  if (agentProductIds.size > 0) {
    const { data: aps } = await supabase
      .from('agent_products')
      .select('id, product_id, agent_id')
      .in('id', Array.from(agentProductIds));
    aps?.forEach((ap) => {
      agentProductLabels[ap.id as string] = `Agent Product ${(ap.id as string).slice(0, 8)}`;
    });
  }

  const formatTarget = (row: {
    scope: string;
    product_id: string | null;
    agent_product_id: string | null;
    tier_name: string | null;
  }): string => {
    if (row.scope === 'agent_retail' && row.agent_product_id) {
      return agentProductLabels[row.agent_product_id] ?? row.agent_product_id;
    }
    if (row.scope === 'tier_multiplier' && row.tier_name) {
      return row.tier_name;
    }
    if (row.scope === 'product_tier_override' && row.product_id) {
      const name = productLabels[row.product_id] ?? row.product_id;
      return `${name} (${row.tier_name ?? '—'})`;
    }
    if (row.product_id) {
      return productLabels[row.product_id] ?? row.product_id;
    }
    return '—';
  };

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>Scheduled Prices</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
          {rows?.length ?? 0} Recorded Price Operations
        </p>
      </div>

      <form
        method="GET"
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--grey-400)', display: 'block', marginBottom: 4 }}>
            Scope
          </label>
          <select
            name="scope"
            defaultValue={scopeFilter}
            className="form-input"
            style={{ minWidth: 200 }}
          >
            <option value="all">All Scopes</option>
            {Object.entries(SCOPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--grey-400)', display: 'block', marginBottom: 4 }}>
            Status
          </label>
          <select
            name="status"
            defaultValue={statusFilter}
            className="form-input"
            style={{ minWidth: 160 }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="applied">Applied</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="submit" className="btn btn-primary">
            Apply Filters
          </button>
        </div>
      </form>

      <div className="card-metal" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Scope</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Target</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Adjustment</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Value</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Effective</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Status</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Applied</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Failed</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>
                  No Scheduled Price Changes Found
                </td>
              </tr>
            ) : (
              (rows ?? []).map((row) => {
                const status = formatStatus(row);
                return (
                  <tr key={row.id as string} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: 'var(--space-3)' }}>
                      {SCOPE_LABELS[row.scope as string] ?? row.scope}
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>{formatTarget(row)}</td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      {ADJUSTMENT_LABELS[row.adjustment_type as string] ?? row.adjustment_type}
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      {formatValue(row.adjustment_type as string, Number(row.new_value))}
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>{formatDate(row.effective_at as string)}</td>
                    <td style={{ padding: 'var(--space-3)', color: status.color, fontWeight: 700 }}>
                      {status.label}
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>{formatDate(row.applied_at as string | null)}</td>
                    <td style={{ padding: 'var(--space-3)' }}>{formatDate(row.failed_at as string | null)}</td>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--grey-400)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(row.failure_reason as string | null) ?? '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
