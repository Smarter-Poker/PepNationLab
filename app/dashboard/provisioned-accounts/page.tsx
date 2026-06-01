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

export default async function AgentProvisionedAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, full_name')
    .eq('id', user.id)
    .single();

  // Agents, super_agents, sub_agents only. Researchers and admins go elsewhere.
  if (!profile || (profile.role !== 'agent' && profile.role !== 'super_agent')) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const filter = params.filter === 'pending' ? 'pending' : params.filter === 'activated' ? 'activated' : 'all';

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('fn_provisioned_accounts', {
    p_creator_scope: user.id,
    p_only_pending: filter === 'pending',
  });
  let rows: ProvisionedRow[] = error || !data ? [] : (data as ProvisionedRow[]);
  if (filter === 'activated') {
    rows = rows.filter((r) => r.first_sign_in_at !== null);
  }

  const totalProvisioned = rows.length;
  const activated = rows.filter((r) => r.first_sign_in_at !== null).length;
  const pending = totalProvisioned - activated;
  const activationRate = totalProvisioned > 0 ? Math.round((activated / totalProvisioned) * 100) : 0;

  const isSuperAgent = profile.is_super_agent === true;
  const isSubAgent = profile.is_sub_agent === true;

  return (
    <div style={{ padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Link href="/dashboard" style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textDecoration: 'none' }}>
          {'< Back To Dashboard'}
        </Link>
        <h1 style={{ fontSize: '1.5rem', margin: '8px 0 6px' }}>Provisioned Accounts</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', margin: 0 }}>
          {isSuperAgent
            ? 'Accounts You And Your Sub-Agents Have Created, And Whether They Have Signed In Yet.'
            : isSubAgent
            ? 'Accounts You Have Created And Whether They Have Signed In Yet.'
            : 'Accounts You Have Created And Whether They Have Signed In Yet.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 'var(--space-5)' }}>
        <div className="metal-frame"><div className="metal-content" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Created</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginTop: 4 }}>{totalProvisioned}</div>
        </div></div>
        <div className="metal-frame"><div className="metal-content" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activated</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal)', marginTop: 4 }}>{activated}</div>
        </div></div>
        <div className="metal-frame"><div className="metal-content" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#F6AD55', marginTop: 4 }}>{pending}</div>
        </div></div>
        <div className="metal-frame"><div className="metal-content" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activation Rate</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginTop: 4 }}>{activationRate}%</div>
        </div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {[
          { v: 'all', l: 'All' },
          { v: 'pending', l: 'Pending First Sign-In' },
          { v: 'activated', l: 'Activated' },
        ].map((c) => {
          const href = c.v === 'all'
            ? '/dashboard/provisioned-accounts'
            : `/dashboard/provisioned-accounts?filter=${c.v}`;
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
      </div>

      {rows.length === 0 ? (
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--grey-400)' }}>
            {filter === 'pending'
              ? 'No Pending Accounts. Every Account You Created Has Signed In.'
              : filter === 'activated'
              ? 'No Activated Accounts Yet.'
              : 'You Have Not Created Any Accounts Yet. Use The Researchers Tab To Add One.'}
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
                    {isSuperAgent && (
                      <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--surface-3)', color: 'var(--grey-300)', fontWeight: 600 }}>Created By</th>
                    )}
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
                    const activatedFlag = r.first_sign_in_at !== null;
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
                        {isSuperAgent && (
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 500, color: 'var(--white)' }}>{r.creator_full_name || r.creator_username || '-'}</div>
                            <div style={{ fontSize: '0.7rem', color: roleColor(r.creator_role_at_creation || r.creator_role) }}>
                              {roleLabel(r.creator_role_at_creation || r.creator_role)}
                            </div>
                          </td>
                        )}
                        <td style={{ padding: '10px 12px', color: 'var(--silver)' }}>{fmtDate(r.user_created_at)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {activatedFlag ? (
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
