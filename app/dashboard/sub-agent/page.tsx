'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PushNotificationToggle from '@/components/PushNotificationToggle';

/**
 * SACA Phase 5: Sub-agent dashboard.
 *
 * Read-only view of:
 *  - Balance + credit cap + payment model
 *  - Pending commission for this week
 *  - Lifetime settled commission
 *  - Last 8 weekly settlements
 *  - Last 10 attributed orders
 */

type Overview = {
  profile: {
    id: string;
    full_name?: string | null;
    username?: string | null;
    email?: string | null;
    commission_pct: number | null;
    commission_active_since: string | null;
    account_type: 'credit' | 'prepaid' | string | null;
    credit_limit: number | null;
    prepaid_balance: number | null;
    parent: {
      id: string;
      full_name: string | null;
      username: string | null;
      email?: string | null;
      storefront_slug?: string | null;
    } | null;
  };
  share_link: string | null;
  pending_commission: number;
  lifetime_commission: number;
  recent_settlements: Array<{ id: string; week_start: string; week_end: string; total_commission: number; orders_count: number; settled_at: string }>;
  recent_orders: Array<{ id: string; total: number; status: string; created_at: string; sub_agent_commission_amount: number | null; sub_agent_commission_pct: number | null }>;
  referred_researchers_count: number;
};

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '$0.00';
  return `$${Number(v).toFixed(2)}`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return s;
  }
}

export default function SubAgentDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sub-agent/overview', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (!cancelled) setData(json as Overview);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed To Load Dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <h1 style={{ fontSize: '28px' }}>Sub-Agent Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px' }}>
        <h1 style={{ fontSize: '28px' }}>Sub-Agent Dashboard</h1>
        <div style={{ color: '#E53E3E', marginTop: '12px' }}>{error || 'No Data.'}</div>
      </div>
    );
  }

  const isCredit = data.profile.account_type === 'credit';
  const availableBalance = isCredit
    ? Number(data.profile.credit_limit ?? 0) + Number(data.profile.prepaid_balance ?? 0)
    : Number(data.profile.prepaid_balance ?? 0);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '4px' }}>Sub-Agent Dashboard</h1>
      <p style={{ opacity: 0.85, marginBottom: '24px' }}>
        Welcome, {data.profile.full_name || data.profile.username || 'Sub-Agent'}.
        {data.profile.parent ? (
          <>
            {' '}You Sell Under <strong>{data.profile.parent.full_name || data.profile.parent.username}</strong>.
          </>
        ) : null}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card-glass" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Balance</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>{fmtMoney(availableBalance)}</div>
          <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
            {isCredit ? (
              <>Credit Line {fmtMoney(data.profile.credit_limit)} + Prepaid {fmtMoney(data.profile.prepaid_balance)}</>
            ) : (
              <>Prepaid Account</>
            )}
          </div>
        </div>

        <div className="card-glass" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Commission</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>{fmtMoney(data.pending_commission)}</div>
          <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
            Earning {data.profile.commission_pct ?? 0}% Per Sale. Credits Settle Sundays.
          </div>
        </div>

        <div className="card-glass" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lifetime Earned</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>{fmtMoney(data.lifetime_commission)}</div>
          <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>{data.recent_settlements.length} Settled Weeks</div>
        </div>

        <div className="card-glass" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Researchers</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>{data.referred_researchers_count}</div>
          <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>Tagged To You</div>
        </div>
      </div>

      {(data.profile.parent || data.share_link) && (
        <div className="card-glass" style={{ padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Your Storefront &amp; Parent Agent</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {data.profile.parent && (
              <div style={{ background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.2)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Parent Agent</div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>
                  {data.profile.parent.full_name || data.profile.parent.username || 'Parent Agent'}
                </div>
                {data.profile.parent.email && (
                  <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px', fontFamily: 'monospace' }}>
                    {data.profile.parent.email}
                  </div>
                )}
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '8px' }}>
                  Approves Every Order And Pays Your Weekly Commission Settlement.
                </div>
              </div>
            )}
            {data.share_link && (
              <div style={{ background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.2)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Your Referral Link</div>
                <div style={{ fontSize: '13px', fontFamily: 'monospace', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}{data.share_link}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const fullUrl = (typeof window !== 'undefined' ? window.location.origin : '') + (data.share_link ?? '');
                    void navigator.clipboard.writeText(fullUrl).then(
                      () => toast.success('Referral Link Copied To Clipboard'),
                      () => toast.error('Could Not Copy Link')
                    );
                  }}
                  className="btn-primary"
                  style={{ fontSize: '12px', padding: '6px 16px' }}
                >
                  Copy Link
                </button>
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '8px' }}>
                  Share This Link With New Researchers. Sign-Ups Through This Link Are Permanently Tagged To You And Earn You Commission On Every Order.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card-glass" style={{ padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Recent Settlements</h2>
        {data.recent_settlements.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No Settled Weeks Yet. Your First Weekly Payout Lands Sunday Night.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Week Of</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Orders</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Credited</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_settlements.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: '6px 4px' }}>{fmtDate(s.week_start)}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{s.orders_count}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{fmtMoney(s.total_commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card-glass" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Recent Orders Attributed To You</h2>
        {data.recent_orders.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No Orders Yet. Once Your Researchers Buy, You&apos;ll See Them Here.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Total</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Your Commission</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ padding: '6px 4px' }}>{fmtDate(o.created_at)}</td>
                  <td style={{ padding: '6px 4px', textTransform: 'capitalize' }}>{(o.status || '').replace(/_/g, ' ')}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{fmtMoney(o.total)}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{fmtMoney(o.sub_agent_commission_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <PushNotificationToggle
          title="Notification Settings"
          description="Enable Push Notifications On This Device For Incoming Calls And New Messages — Even When The App Is Closed."
        />
      </div>
    </div>
  );
}
