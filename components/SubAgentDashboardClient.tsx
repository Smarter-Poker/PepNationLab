'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import AgentOverview from '@/components/AgentOverview';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import Link from 'next/link';
import WalletCard from '@/components/WalletCard';
import Navbar from '@/components/Navbar';
import MyQRCodeModal from '@/components/MyQRCodeModal';

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
  const [showQRModal, setShowQRModal] = useState(false);

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
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      {/* Mobile Top Navbar (Global) */}
      <Navbar title={data.profile.full_name || 'SUB-AGENT DASHBOARD'} />
      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 'env(safe-area-inset-bottom, 24px)', marginTop: 'var(--nav-offset, 60px)' }}>
        <div className="dashboard-main" style={{ minHeight: 'calc(100dvh - var(--nav-offset, 60px))' }}>
          <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: activeTab === 'Overview' ? 0 : 'var(--space-12)' }}>
            
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
                  isSubAgent={true}
                  onNavigate={(tab) => {
                    if (tab === 'Store Products' || tab === 'Inventory') {
                      toast.info('Inventory and Products are managed by your Parent Agent.');
                    } else {
                      setActiveTab(tab);
                      // setIsMobileMenuOpen(false);
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
                  <div className="glass-panel stagger-fade-in" style={{ padding: '20px', marginBottom: '24px', borderRadius: '16px' }}>
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
                <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: '16px' }}>
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{data.referred_researchers_count}</div>
                    <div style={{ fontSize: '14px', opacity: 0.7 }}>Total Researchers Tagged To You</div>
                  </div>
                </div>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'Orders' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Attributed Orders</h1>
                <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Recent Order Activity</h3>
                    {data.recent_orders.length === 0 ? (
                      <p style={{ opacity: 0.7 }}>No orders yet. Start sharing your referral link!</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {data.recent_orders.map(o => (
                          <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>Order #{o.id.split('-')[0].toUpperCase()}</div>
                              <div style={{ fontSize: '13px', opacity: 0.7 }}>{fmtDate(o.created_at)} &bull; {o.status.toUpperCase()}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, color: 'var(--teal)' }}>+{fmtMoney(o.sub_agent_commission_amount)}</div>
                              <div style={{ fontSize: '13px', opacity: 0.7 }}>{o.sub_agent_commission_pct}% Cut</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sales & Accounting Tab */}
            {activeTab === 'Sales & Accounting' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Sales & Accounting</h1>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '14px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Pending Commission</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--teal)' }}>{fmtMoney(data.pending_commission)}</div>
                  </div>
                  <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: '16px', animationDelay: '0.1s' }}>
                    <div style={{ fontSize: '14px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Lifetime Commission</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--teal)' }}>{fmtMoney(data.lifetime_commission)}</div>
                  </div>
                </div>

                <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: '16px', animationDelay: '0.2s' }}>
                  <h3 style={{ fontSize: '14px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Recent Settlements</h3>
                  {data.recent_settlements.length === 0 ? (
                    <p style={{ opacity: 0.7 }}>No settlements yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {data.recent_settlements.map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{fmtDate(s.week_start)} - {fmtDate(s.week_end)}</div>
                            <div style={{ fontSize: '13px', opacity: 0.7 }}>{s.orders_count} orders &bull; Settled {fmtDate(s.settled_at)}</div>
                          </div>
                          <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--teal)' }}>
                            {fmtMoney(s.total_commission)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <MyQRCodeModal open={showQRModal} onClose={() => setShowQRModal(false)} />
    </div>
  );
}
