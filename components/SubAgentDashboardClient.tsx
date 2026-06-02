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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
  
  const SUBAGENT_SIDEBAR_ITEMS = [
    { id: 'Overview', type: 'tab', label: 'Overview', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg> },
    { id: 'Researchers', type: 'tab', label: 'Researchers', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
    { id: 'qr', type: 'action', label: 'My Invite QR', action: () => { setIsMobileMenuOpen(false); requestAnimationFrame(() => setShowQRModal(true)); }, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /><rect x="19" y="14" width="2" height="2" /><rect x="14" y="19" width="2" height="2" /><rect x="19" y="19" width="2" height="2" /></svg> },
    { id: 'Orders', type: 'tab', label: 'Orders', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg> },
    { id: 'Sales & Accounting', type: 'tab', label: 'Sales & Accounting', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
    { id: 'wallet', type: 'link', label: 'Wallet', href: '/wallet', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg> },
    { id: 'messenger', type: 'link', label: 'Messenger', href: '/messenger', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
    { id: 'Settings', type: 'link', label: 'Account Settings', href: '/account', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
    ...(data.share_link ? [{ id: 'storefront-display', type: 'storefront-display' }] : []),
    { id: 'divider-help', type: 'separator' },
    { id: 'help', type: 'link', href: '/account/help', label: 'Help & Support', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg> },
    { id: 'signout', type: 'form', label: 'Sign Out', actionUrl: '/api/auth/signout', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>, color: 'var(--red)' }
  ] as any[];

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      {/* Mobile Top Navbar (Global) */}
      <Navbar onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} title={data.profile.full_name || 'SUB-AGENT DASHBOARD'} />

      {/* Overlay to close menu when clicking outside */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 'var(--nav-offset, 60px)',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 40,
            cursor: 'pointer'
          }}
        />
      )}

      {/* Sidebar */}
      <div className="sidebar" style={{ 
        transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SUBAGENT_SIDEBAR_ITEMS.map((item) => {
            if (item.type === 'tab') {
              return (
                <button
                  key={item.id}
                  onClick={() => { 
                    setActiveTab(item.id); 
                    setIsMobileMenuOpen(false); 
                  }}
                  className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  style={{ 
                    background: 'transparent', 
                    width: '100%', 
                    textAlign: 'left', 
                    border: 'none', 
                    borderLeft: activeTab === item.id ? '3px solid var(--teal)' : '3px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%' }}>
                    {item.icon}
                    <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>{item.label}</span>
                  </div>
                </button>
              );
            }
            if (item.type === 'action') {
              return (
                <button
                  key={item.id}
                  className="sidebar-nav-item"
                  onClick={item.action}
                  style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', borderLeft: '3px solid transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {item.icon}
                    <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', color: item.color || 'currentColor', transition: 'color 0.2s' }}>
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            }
            if (item.type === 'link') {
              return (
                <Link key={item.id} href={item.href!} className="sidebar-nav-item" style={{ display: 'block', textDecoration: 'none', borderLeft: '3px solid transparent' }} onClick={() => setIsMobileMenuOpen(false)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {item.icon}
                    <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>{item.label}</span>
                  </div>
                </Link>
              );
            }
            if (item.type === 'form') {
              return (
                <form key={item.id} action={item.actionUrl} method="post">
                  <button type="submit" className="sidebar-nav-item" style={{ width: '100%', background: 'transparent', border: 'none', color: item.color, borderLeft: '3px solid transparent', paddingBottom: 'max(var(--space-8), env(safe-area-inset-bottom, 32px))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      {item.icon}
                      <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>{item.label}</span>
                    </div>
                  </button>
                </form>
              );
            }
            if (item.type === 'separator') {
              return <div key={item.id} style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-2) 0' }} />;
            }
            if (item.type === 'storefront-display') {
              return (
                <div key={item.id} style={{ padding: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginBottom: '8px', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>Storefront Link</div>
                  <div style={{ 
                    background: 'rgba(0,0,0,0.3)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <div style={{ 
                      fontSize: '0.8rem', 
                      color: 'var(--silver)', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace'
                    }}>
                      pepnationlab.com{data.share_link}
                    </div>
                    <button 
                      onClick={(e) => { e.preventDefault(); copyStorefrontLink(); }}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: copiedStorefront ? 'var(--teal)' : 'var(--grey-400)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Copy Link"
                    >
                      {copiedStorefront ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
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
                  onNavigate={(tab) => {
                    if (tab === 'Store Products' || tab === 'Inventory') {
                      toast.info('Inventory and Products are managed by your Parent Agent.');
                    } else {
                      setActiveTab(tab);
                      setIsMobileMenuOpen(false);
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
                <div className="metal-frame">
                  <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
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
                <div className="metal-frame">
                  <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                  <WalletCard />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="metal-frame">
                      <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
                        <div style={{ fontSize: '14px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Pending Commission (This Week)</div>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--teal)', textShadow: '0 0 10px rgba(0,196,188,0.3)' }}>{fmtMoney(data.pending_commission)}</div>
                        <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '8px' }}>Will be settled to your Wallet on Monday at 2am ET.</div>
                      </div>
                    </div>
                    <div className="metal-frame">
                      <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
                        <div style={{ fontSize: '14px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Lifetime Commission Earned</div>
                        <div style={{ fontSize: '24px', fontWeight: 700 }}>{fmtMoney(data.lifetime_commission)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="metal-frame">
                  <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: '14px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Recent Weekly Settlements</h3>
                    {data.recent_settlements.length === 0 ? (
                      <p style={{ opacity: 0.7 }}>No weekly settlements yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {data.recent_settlements.map(s => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>Week of {fmtDate(s.week_start)}</div>
                              <div style={{ fontSize: '13px', opacity: 0.7 }}>Settled {fmtDate(s.settled_at)} &bull; {s.orders_count} Orders</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, color: 'var(--teal)' }}>+{fmtMoney(s.total_commission)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
