import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

interface ProvisionedRow {
  user_id: string;
  user_full_name: string | null;
  user_username: string | null;
  user_role: string;
  user_is_active: boolean;
  user_created_at: string;
  first_sign_in_at: string | null;
  last_sign_in_at: string | null;
  sign_in_count: number;
  account_activated_at: string | null;
  creator_id: string | null;
  creator_full_name: string | null;
  creator_username: string | null;
  creator_role: string | null;
  creator_role_at_creation: string | null;
}

function fmtDate(s: string | null): string {
  if (!s) return '-';
  try {
    return new Date(s).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch { return s; }
}

function fmtDuration(fromIso: string, toIso: string | null): string {
  if (!toIso) return '-';
  try {
    const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Under A Minute';
    if (mins < 60) return `${mins} Min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} Hr ${mins % 60} Min`;
    const days = Math.floor(hours / 24);
    return `${days} Day${days === 1 ? '' : 's'}`;
  } catch { return '-'; }
}

function roleLabel(role: string | null): string {
  if (!role) return 'Unknown';
  if (role === 'admin') return 'Admin';
  if (role === 'super_agent') return 'Super Agent';
  if (role === 'sub_agent') return 'Sub-Agent';
  if (role === 'agent') return 'Agent';
  if (role === 'researcher') return 'Researcher';
  return role;
}

function roleColor(role: string | null): string {
  if (role === 'admin') return 'var(--red, #E53E3E)';
  if (role === 'super_agent') return 'var(--teal, #00C4BC)';
  if (role === 'sub_agent') return '#F6AD55';
  if (role === 'agent') return 'var(--silver, #A8B4C0)';
  return 'var(--grey-400, #A8B4C0)';
}

export default async function AdminProvisionedAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; creator?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const params = await searchParams;
  const filter = params.filter === 'pending' ? 'pending' : params.filter === 'activated' ? 'activated' : 'all';
  const creatorScope = params.creator && /^[0-9a-f-]{36}$/i.test(params.creator) ? params.creator : null;

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('fn_provisioned_accounts', {
    p_creator_scope: creatorScope,
    p_only_pending: filter === 'pending',
  });
  let rows: ProvisionedRow[] = error || !data ? [] : (data as ProvisionedRow[]);
  if (filter === 'activated') {
    rows = rows.filter((r) => r.first_sign_in_at !== null);
  }

  // Stats
  const totalProvisioned = rows.length;
  const activated = rows.filter((r) => r.first_sign_in_at !== null).length;
  const pending = totalProvisioned - activated;
  const activationRate = totalProvisioned > 0 ? Math.round((activated / totalProvisioned) * 100) : 0;

  // Group by creator for the breakdown card
  const byCreator = new Map<string, { name: string; role: string; total: number; activated: number }>();
  for (const r of rows) {
    if (!r.creator_id) continue;
    const key = r.creator_id;
    const existing = byCreator.get(key);
    const name = r.creator_full_name || r.creator_username || 'Unknown';
    const role = r.creator_role_at_creation || r.creator_role || 'agent';
    if (existing) {
      existing.total += 1;
      if (r.first_sign_in_at) existing.activated += 1;
    } else {
      byCreator.set(key, { name, role, total: 1, activated: r.first_sign_in_at ? 1 : 0 });
    }
  }

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Provisioned Accounts</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 6, marginBottom: 0 }}>
            Accounts Created By Agents, Sub-Agents, Super Agents, And Admins. Tracks Whether The Account Has Officially Signed In.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 'var(--space-5)' }}>
        <div className="metal-frame"><div className="metal-content" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Provisioned</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--white)', marginTop: 4 }}>{totalProvisioned}</div>
        </div></div>
        <div className="metal-frame"><div className="metal-content" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activated</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--teal)', marginTop: 4 }}>{activated}</div>
        </div></div>
        <div className="metal-frame"><div className="metal-content" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending First Sign-In</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#F6AD55', marginTop: 4 }}>{pending}</div>
        </div></div>
        <div className="metal-frame"><div className="metal-content" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activation Rate</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--white)', marginTop: 4 }}>{activationRate}%</div>
        </div></div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {[
          { v: 'all', l: 'All' },
          { v: 'pending', l: 'Pending First Sign-In' },
          { v: 'activated', l: 'Activated' },
        ].map((c) => {
          const params = new URLSearchParams();
          if (c.v !== 'all') params.set('filter', c.v);
          if (creatorScope) params.set('creator', creatorScope);
          const href = '/admin/provisioned-accounts' + (params.toString() ? '?' + params.toString() : '');
          const active = filter === c.v;
          return (
            <Link key={c.v} href={href} style={{
              padding: '6px 14px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
              background: active ? 'var(--teal)' : 'var(--surface-1, #0F1923)',
              color: active ? 'var(--black)' : 'var(--silver)',
              border: '1px solid var(--surface-3, #1D2D3E)',
              textDecoration: 'none',
            }}>{c.l}</Link>
          );
        })}
        {creatorScope && (
          <Link href="/admin/provisioned-accounts" style={{
            padding: '6px 14px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
            background: 'rgba(229,62,62,0.15)', color: '#E53E3E',
            border: '1px solid rgba(229,62,62,0.4)', textDecoration: 'none',
          }}>Clear Creator Filter</Link>
        )}
      </div>

      {/* By-creator breakdown */}
      {byCreator.size > 0 && (
        <div className="metal-frame" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--white)', marginBottom: 12 }}>By Creator</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
              {Array.from(byCreator.entries())
                .sort((a, b) => b[1].total - a[1].total)
                .map(([id, info]) => {
                  const params = new URLSearchParams();
                  params.set('creator', id);
                  if (filter !== 'all') params.set('filter', filter);
                  const href = '/admin/provisioned-accounts?' + params.toString();
                  return (
                    <Link key={id} href={href} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--surface-1, #0F1923)',
                      border: '1px solid var(--surface-3, #1D2D3E)',
                      borderRadius: 8,
                      textDecoration: 'none', color: 'inherit',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--white)', fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</div>
                        <div style={{ fontSize: '0.7rem', color: roleColor(info.role), marginTop: 2 }}>{roleLabel(info.role)}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--teal)' }}>{info.activated}/{info.total}</div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--grey-400)' }}>Activated</div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Account list */}
      {rows.length === 0 ? (
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--grey-400)' }}>
            {filter === 'pending'
              ? 'No Pending Accounts. Every Provisioned Account Has Signed In.'
              : filter === 'activated'
              ? 'No Activated Accounts In Scope.'
              : 'No Provisioned Accounts Yet. Accounts Created By Agents Or Admins Will Appear Here.'}
          </div>
        </div>
      ) : (
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-1, #0F1923)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>User</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>Role</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>Created By</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>Created</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>First Sign-In</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>Time To First Sign-In</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>Last Sign-In</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>Sign-Ins</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const activated = r.first_sign_in_at !== null;
                    return (
                      <tr key={r.user_id} style={{ borderBottom: '1px solid var(--surface-2, #162230)', opacity: r.user_is_active ? 1 : 0.55 }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--white)' }}>{r.user_full_name || '-'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>@{r.user_username || '-'}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, border: `1px solid ${roleColor(r.user_role)}`, color: roleColor(r.user_role), fontWeight: 700 }}>
                            {roleLabel(r.user_role)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 500, color: 'var(--white)' }}>{r.creator_full_name || r.creator_username || '-'}</div>
                          <div style={{ fontSize: '0.7rem', color: roleColor(r.creator_role_at_creation || r.creator_role) }}>
                            {roleLabel(r.creator_role_at_creation || r.creator_role)}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--silver)' }}>{fmtDate(r.user_created_at)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {activated ? (
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, background: 'rgba(0,196,188,0.15)', color: 'var(--teal)', fontWeight: 700 }}>
                              Activated
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, background: 'rgba(246,173,85,0.15)', color: '#F6AD55', fontWeight: 700 }}>
                              Pending
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--silver)' }}>{fmtDate(r.first_sign_in_at)}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--grey-400)', fontSize: '0.78rem' }}>{fmtDuration(r.user_created_at, r.first_sign_in_at)}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--silver)' }}>{fmtDate(r.last_sign_in_at)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--white)', fontWeight: 600 }}>{r.sign_in_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
