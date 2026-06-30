import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ReparentControl from '@/components/admin/ReparentControl';

interface TreeRow {
  id: string;
  parent_id: string | null;
  depth: number;
  path: string;
  name: string;
  username: string | null;
  email: string | null;
  role: string;
  is_super_agent: boolean;
  is_active: boolean;
  gmv: number;
  order_count: number;
}

function fmtMoney(n: number): string {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function roleBadge(row: TreeRow): { label: string; color: string } {
  if (row.role === 'admin') return { label: 'Admin', color: 'var(--red, #E53E3E)' };
  if (row.role === 'agent' && row.is_super_agent) return { label: 'Super Agent', color: 'var(--teal, #00C4BC)' };
  if (row.role === 'agent') return { label: 'Agent', color: 'var(--silver, #A8B4C0)' };
  return { label: row.role, color: 'var(--grey-400, #A8B4C0)' };
}

export default async function AdminNetworkPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('fn_admin_downline_tree', { p_days: 30 });
  const rows: TreeRow[] = error || !data ? [] : (data as TreeRow[]);

  // Compute aggregated leg GMV (own + descendants) for each node
  const legGmv = new Map<string, number>();
  for (const r of rows) {
    const idsInPath = r.path.split('/');
    for (const aid of idsInPath) {
      legGmv.set(aid, (legGmv.get(aid) ?? 0) + Number(r.gmv || 0));
    }
    if (!legGmv.has(r.id)) legGmv.set(r.id, Number(r.gmv || 0));
  }

  // Build a flat list for the ReparentControl picker (agents + super agents only)
  const reparentOptions = rows
    .filter((r) => r.role === 'agent' || r.role === 'super_agent')
    .map((r) => ({
      id: r.id,
      name: r.name + (r.username ? ` (@${r.username})` : ''),
      parent_id: r.parent_id,
      role: r.role,
      is_super_agent: r.is_super_agent,
    }));

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', margin: 0 }}>Network Map</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 6, marginBottom: 0 }}>
            Agent Downline - Last 30 Days Revenue Per Leg
          </p>
        </div>
        <Link href="/admin/agents" style={{ fontSize: '0.85rem', color: 'var(--teal)', textDecoration: 'none' }}>Manage Agents</Link>
      </div>

      {reparentOptions.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <ReparentControl people={reparentOptions} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--grey-400)' }}>
            No Agent Network Detected.
          </div>
        </div>
      ) : (
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map((row) => {
                const badge = roleBadge(row);
                const indent = row.depth * 28;
                const leg = legGmv.get(row.id) ?? 0;
                return (
                  <Link
                    key={row.id}
                    href={`/admin/transactions?agent=${encodeURIComponent(row.id)}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', paddingLeft: 12 + indent,
                      background: 'var(--surface-1, #0F1923)',
                      border: '1px solid var(--surface-3, #1D2D3E)',
                      borderLeft: row.depth > 0 ? `3px solid ${badge.color}` : '1px solid var(--surface-3, #1D2D3E)',
                      borderRadius: 8,
                      textDecoration: 'none', color: 'inherit',
                      opacity: row.is_active ? 1 : 0.55,
                    }}
                  >
                    {row.depth > 0 && (
                      <span aria-hidden="true" style={{ color: 'var(--grey-500)', fontSize: '0.75rem', flexShrink: 0 }}>
                        {'└─'}
                      </span>
                    )}
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--white, #FFFFFF)', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.name}
                      {!row.is_active && <span style={{ marginLeft: 8, fontSize: '0.62rem', padding: '1px 6px', borderRadius: 999, background: 'rgba(168,180,192,0.18)', color: 'var(--grey-300)', fontWeight: 700, textTransform: 'uppercase' }}>Inactive</span>}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, border: `1px solid ${badge.color}`, color: badge.color, fontWeight: 700, flexShrink: 0 }}>
                      {badge.label}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 160, flexShrink: 0 }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--teal, #00C4BC)' }}>
                        {fmtMoney(row.gmv)} <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 500 }}>own</span>
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>
                        Leg Total: {fmtMoney(leg)}{row.order_count > 0 ? ` - ${row.order_count} Orders` : ''}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
