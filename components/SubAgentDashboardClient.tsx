'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import AgentOverview from '@/components/AgentOverview';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import Link from 'next/link';
import WalletCard from '@/components/WalletCard';

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

export default function SubAgentDashboardClient({ data, onRefresh }: { data: Overview, onRefresh: () => Promise<void> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const defaultTab = 'Overview';
  const activeTab = tabParam || defaultTab;
  
  const [copiedStorefront, setCopiedStorefront] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('tab', tab);
    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const storefrontUrl = data.share_link ? `${originUrl}${data.share_link}` : '';

  const copyStorefrontLink = () => {
    if (!storefrontUrl) return;
    navigator.clipboard.writeText(storefrontUrl);
    setCopiedStorefront(true);
    setTimeout(() => setCopiedStorefront(false), 2000);
  };

  const isCredit = data.profile.account_type === 'credit';
  const availableBalance = isCredit
    ? Number(data.profile.credit_limit ?? 0) + Number(data.profile.prepaid_balance ?? 0)
    : Number(data.profile.prepaid_balance ?? 0);

  return (
    <div className="dashboard-main" style={{ minHeight: '100dvh' }}>
      <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: activeTab === 'Overview' ? 0 : 'var(--space-12)' }}>
        
        {/* Navigation back to Overview if deep linked */}
        {activeTab !== 'Overview' && (
          <button 
            onClick={() => setActiveTab('Overview')} 
            className="btn btn-ghost btn-sm" 
            style={{ marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to Overview
          </button>
        )}

        {/* Overview (Metallic 6-Button Image) */}
        {activeTab === 'Overview' && (
          <div style={{
            animation: 'fadeIn 0.3s ease-out',
            /* Bust out of the container so the image goes edge-to-edge */
            marginLeft: 'calc(-1 * var(--container-px, var(--space-6)))',
            marginRight: 'calc(-1 * var(--container-px, var(--space-6)))',
            marginTop: 'calc(-1 * var(--space-8))',
          }}>
            <AgentOverview 
              activeResearchersCount={data.referred_researchers_count}
              activeOrdersCount={data.recent_orders.length}
              totalRevenue={0} // Not tracked directly on sub-agent overview API
              storefrontUrl={storefrontUrl}
              copyStorefrontLink={copyStorefrontLink}
              copiedStorefront={copiedStorefront}
              agentProfile={{ slug: data.profile.parent?.storefront_slug }}
              orders={data.recent_orders}
              onNavigate={(tab) => {
                if (tab === 'Store Products' || tab === 'Inventory') {
                  toast.info('Inventory and Products are managed by your Parent Agent.');
                } else {
                  setActiveTab(tab);
                }
              }}
            />
          </div>
        )}

        {/* Researchers Tab */}
        {activeTab === 'Researchers' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Researchers</h1>
            {data.share_link && (
              <div className="card-glass" style={{ padding: '20px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Invite Researchers</h2>
                <div style={{ background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.2)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Your Referral Link</div>
                  <div style={{ fontSize: '13px', fontFamily: 'monospace', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
                    {storefrontUrl}
                  </div>
                  <button
                    type="button"
                    onClick={copyStorefrontLink}
                    className="btn-primary"
                    style={{ fontSize: '12px', padding: '6px 16px' }}
                  >
                    {copiedStorefront ? 'Copied!' : 'Copy Link'}
                  </button>
                  <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '8px' }}>
                    Share This Link With New Researchers. Sign-Ups Through This Link Are Permanently Tagged To You And Earn You Commission On Every Order.
                  </div>
                </div>
              </div>
            )}
            <div className="card-glass" style={{ padding: '20px' }}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{data.referred_researchers_count}</div>
              <div style={{ fontSize: '14px', opacity: 0.7 }}>Total Researchers Tagged To You</div>
            </div>
          </div>
        )}

        {/* Sales & Accounting Tab */}
        {activeTab === 'Sales & Accounting' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '24px' }}>Sales & Accounting</h1>
              <button
                type="button"
                disabled={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  await onRefresh();
                  setRefreshing(false);
                  toast.success('Balance Refreshed');
                }}
                className="btn btn-primary btn-sm"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Balance'}
              </button>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <WalletCard />
            </div>

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
                  Earning {data.profile.commission_pct ?? 0}% Of Total Sales. Credits Settle Sundays.
                </div>
              </div>

              <div className="card-glass" style={{ padding: '16px' }}>
                <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lifetime Earned</div>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>{fmtMoney(data.lifetime_commission)}</div>
                <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>{data.recent_settlements.length} Settled Weeks</div>
              </div>
            </div>

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
          </div>
        )}

        {/* Orders & Fulfillment Tab */}
        {activeTab === 'Orders' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Orders & Fulfillment</h1>
            <div className="card-glass" style={{ padding: '20px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Recent Orders Attributed To You</h2>
              <p style={{ opacity: 0.7, fontSize: '0.85rem', marginBottom: '16px' }}>Orders are fulfilled by your Parent Agent. You earn commission on completed sales.</p>
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
          </div>
        )}

      </div>
    </div>
  );
}
