import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServiceClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const metadata = { title: 'Referral Program | Admin' };

interface ReferralSettings {
  id: number;
  is_active: boolean;
  referrer_reward: number;
  referee_reward: number;
  min_order_total: number;
  updated_at: string | null;
}

interface ResearcherReferral {
  id: string;
  referrer_id: string;
  referee_email: string | null;
  code: string | null;
  status: string;
  qualifying_order_id: string | null;
  referrer_reward_amount: number | null;
  referee_reward_amount: number | null;
  applied_at: string | null;
  rewarded_at: string | null;
  expires_at: string | null;
  created_at: string;
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '--';
  return new Date(val).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtUsd(val: number | null | undefined): string {
  if (val === null || val === undefined) return '--';
  return `$${Number(val).toFixed(2)}`;
}

function truncId(id: string | null): string {
  if (!id) return '--';
  return `${id.slice(0, 8)}...`;
}

function StatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, React.CSSProperties> = {
    pending: {
      background: 'rgba(237, 137, 54, 0.15)',
      color: '#ED8936',
      border: '1px solid rgba(237, 137, 54, 0.3)',
    },
    rewarded: {
      background: 'rgba(72, 187, 120, 0.15)',
      color: '#48BB78',
      border: '1px solid rgba(72, 187, 120, 0.3)',
    },
    expired: {
      background: 'rgba(229, 62, 62, 0.15)',
      color: '#E53E3E',
      border: '1px solid rgba(229, 62, 62, 0.3)',
    },
    failed: {
      background: 'rgba(229, 62, 62, 0.15)',
      color: '#E53E3E',
      border: '1px solid rgba(229, 62, 62, 0.3)',
    },
  };
  const style = styleMap[status] ?? {
    background: 'rgba(168, 180, 192, 0.15)',
    color: '#A8B4C0',
    border: '1px solid rgba(168, 180, 192, 0.3)',
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      style={{
        ...style,
        padding: '0.2rem 0.6rem',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  );
}

export default async function AdminReferralsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  const supabase = await createServiceClient();

  const { data: settingsRaw } = await supabase
    .from('referral_settings')
    .select('id, is_active, referrer_reward, referee_reward, min_order_total, updated_at')
    .eq('id', 1)
    .maybeSingle();

  const settings = settingsRaw as ReferralSettings | null;

  const { data: referralsRaw } = await supabase
    .from('researcher_referrals')
    .select(
      'id, referrer_id, referee_email, code, status, qualifying_order_id, referrer_reward_amount, referee_reward_amount, applied_at, rewarded_at, expires_at, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const list = (referralsRaw ?? []) as ResearcherReferral[];

  const countPending = list.filter((r) => r.status === 'pending').length;
  const countRewarded = list.filter((r) => r.status === 'rewarded').length;
  const totalPaid = list
    .filter((r) => r.status === 'rewarded')
    .reduce((sum, r) => sum + (Number(r.referrer_reward_amount) || 0), 0);

  async function saveSettings(formData: FormData) {
    'use server';
    const gate = await requireAdmin();
    if (!gate.ok) throw new Error('Unauthorized');
    const admin = createAdminClient();
    await admin.from('referral_settings').upsert({
      id: 1,
      is_active: formData.get('is_active') === 'on',
      referrer_reward: Number(formData.get('referrer_reward') || 0),
      referee_reward: Number(formData.get('referee_reward') || 0),
      min_order_total: Number(formData.get('min_order_total') || 0),
      updated_at: new Date().toISOString(),
      updated_by: gate.userId,
    });
    revalidatePath('/admin/referrals');
  }

  const isProgramActive = settings?.is_active ?? false;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Referral Program
          </h1>
          <p
            style={{
              margin: '0.3rem 0 0',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Manage Researcher Referral Settings And Review Reward Payouts
          </p>
        </div>
        <span
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            flexShrink: 0,
            background: isProgramActive
              ? 'rgba(72, 187, 120, 0.15)'
              : 'rgba(229, 62, 62, 0.15)',
            color: isProgramActive ? '#48BB78' : '#E53E3E',
            border: isProgramActive
              ? '1px solid rgba(72, 187, 120, 0.3)'
              : '1px solid rgba(229, 62, 62, 0.3)',
          }}
        >
          {isProgramActive ? 'Program Active' : 'Program Inactive'}
        </span>
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {[
          { label: 'Total Referrals', value: list.length.toString() },
          { label: 'Pending Reward', value: countPending.toString() },
          { label: 'Rewarded', value: countRewarded.toString() },
          { label: 'Total Paid Out', value: fmtUsd(totalPaid) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card"
            style={{ padding: '1.25rem', textAlign: 'center' }}
          >
            <div
              style={{
                fontSize: '1.7rem',
                fontWeight: 700,
                color: 'var(--color-primary, #00C4BC)',
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                marginTop: '0.3rem',
                fontWeight: 500,
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Settings Card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h2
          style={{
            margin: '0 0 1.25rem',
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Program Settings
        </h2>
        <form action={saveSettings}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.25rem',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Referrer Reward (USD)
              </span>
              <input
                type="number"
                name="referrer_reward"
                min="0"
                step="0.01"
                defaultValue={settings?.referrer_reward ?? 10}
                className="input"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Referee Reward (USD)
              </span>
              <input
                type="number"
                name="referee_reward"
                min="0"
                step="0.01"
                defaultValue={settings?.referee_reward ?? 5}
                className="input"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Minimum Order Total (USD)
              </span>
              <input
                type="number"
                name="min_order_total"
                min="0"
                step="0.01"
                defaultValue={settings?.min_order_total ?? 50}
                className="input"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Program Status
              </span>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  marginTop: '0.4rem',
                }}
              >
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={isProgramActive}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--color-primary, #00C4BC)',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Enable Referral Program
                </span>
              </label>
            </label>
          </div>

          {settings?.updated_at && (
            <p
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                margin: '0 0 1rem',
              }}
            >
              Last Updated: {fmtDate(settings.updated_at)}
            </p>
          )}

          <button type="submit" className="btn-primary" style={{ fontSize: '0.9rem' }}>
            Save Settings
          </button>
        </form>
      </div>

      {/* Referrals Table */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2
          style={{
            margin: '0 0 1.25rem',
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Referral Records{' '}
          {list.length > 0 && (
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                fontWeight: 400,
                marginLeft: '0.4rem',
              }}
            >
              ({list.length} Shown)
            </span>
          )}
        </h2>

        {list.length === 0 ? (
          <p
            style={{
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '3rem 0',
              fontSize: '0.95rem',
            }}
          >
            No Referrals Yet
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {[
                    'Status',
                    'Code',
                    'Referee Email',
                    'Referrer Reward',
                    'Referee Reward',
                    'Qualifying Order',
                    'Created',
                    'Rewarded',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '0.6rem 0.75rem',
                        textAlign: 'left',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.73rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((ref) => (
                  <tr
                    key={ref.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      verticalAlign: 'middle',
                    }}
                  >
                    <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={ref.status} />
                    </td>
                    <td
                      style={{
                        padding: '0.65rem 0.75rem',
                        fontFamily: 'monospace',
                        color: 'var(--color-primary, #00C4BC)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ref.code ?? '--'}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem 0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {ref.referee_email ?? '--'}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem 0.75rem',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {fmtUsd(ref.referrer_reward_amount)}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem 0.75rem',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {fmtUsd(ref.referee_reward_amount)}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem 0.75rem',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {truncId(ref.qualifying_order_id)}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem 0.75rem',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {fmtDate(ref.created_at)}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem 0.75rem',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {fmtDate(ref.rewarded_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
