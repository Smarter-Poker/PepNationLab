import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Users,
  DollarSign,
  ClipboardList,
  MessageSquare,
  Wallet,
  BookOpen,
  Settings,
  HelpCircle,
  TrendingUp,
  AlertCircle,
  Hourglass,
  PackageSearch,
  Users2,
  Copy,
  Check,
  Wrench,
  Ticket,
  Store,
  FlaskConical,
  Inbox,
} from 'lucide-react';

interface OverviewOrder {
  id: string;
  status: string;
  total: number;
  created_at: string;
  buyer_name?: string | null;
  buyer_email?: string | null;
}

interface AgentOverviewProps {
  activeResearchersCount: number;
  activeOrdersCount: number;
  totalRevenue: number;
  storefrontUrl: string;
  copyStorefrontLink: () => void;
  copiedStorefront: boolean;
  agentProfile: any;
  orders: OverviewOrder[];
  userProfile?: any;
  isSubAgent?: boolean;
  onNavigate?: (tab: string) => void;
}

/* Statuses whose revenue is considered collected. Kept identical to the
 * collectedStatuses list in AgentDashboardClient so the two never disagree. */
const COLLECTED_STATUSES = ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_customer_payment: { label: 'Pending Payment', color: '#F6C761', bg: 'rgba(246, 199, 97, 0.12)' },
  agent_approval_pending: { label: 'Needs Approval', color: '#F6A461', bg: 'rgba(246, 164, 97, 0.12)' },
  admin_approval_pending: { label: 'Awaiting Admin', color: '#F6A461', bg: 'rgba(246, 164, 97, 0.12)' },
  approved_ship: { label: 'Approved Ship', color: '#61D6F6', bg: 'rgba(97, 214, 246, 0.12)' },
  approved_pickup: { label: 'Approved Pickup', color: '#61D6F6', bg: 'rgba(97, 214, 246, 0.12)' },
  in_fulfillment: { label: 'In Fulfillment', color: '#8FA8F6', bg: 'rgba(143, 168, 246, 0.12)' },
  shipped: { label: 'Shipped', color: '#7BE0C3', bg: 'rgba(123, 224, 195, 0.12)' },
  delivered: { label: 'Delivered', color: '#7BE08F', bg: 'rgba(123, 224, 143, 0.12)' },
  cancelled: { label: 'Cancelled', color: 'var(--grey-400, #8090A0)', bg: 'rgba(128, 144, 160, 0.12)' },
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just Now';
  if (mins < 60) return `${mins}m Ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h Ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d Ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AgentOverview({
  activeResearchersCount,
  activeOrdersCount,
  totalRevenue,
  storefrontUrl,
  copyStorefrontLink,
  copiedStorefront,
  agentProfile,
  userProfile,
  isSubAgent: explicitIsSubAgent,
  orders,
  onNavigate,
}: AgentOverviewProps) {
  const router = useRouter();
  const isSubAgent = explicitIsSubAgent ?? (userProfile?.is_sub_agent === true);

  const handleNav = (href: string) => {
    if (!href) return;
    if (href.startsWith('http')) {
      try {
        const urlObj = new URL(href);
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        if (urlObj.origin === currentOrigin) {
          router.push(urlObj.pathname + urlObj.search + urlObj.hash);
          return;
        }
      } catch {
        /* fall through to hard navigation */
      }
      window.location.href = href;
    } else {
      router.push(href);
    }
  };

  /* --- Live KPI Calculations (real order data, real status enums) --- */
  const { todayRevenue, needsApprovalCount, awaitingPaymentCount, recentOrders } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let tRev = 0;
    let approval = 0;
    let awaiting = 0;

    (orders || []).forEach((o) => {
      if (o.status === 'agent_approval_pending') approval++;
      if (o.status === 'pending_customer_payment') awaiting++;
      if (COLLECTED_STATUSES.includes(o.status) && o.created_at) {
        if (new Date(o.created_at).getTime() >= todayStart) {
          tRev += Number(o.total) || 0;
        }
      }
    });

    const recent = [...(orders || [])]
      .filter((o) => o.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);

    return {
      todayRevenue: tRev,
      needsApprovalCount: approval,
      awaitingPaymentCount: awaiting,
      recentOrders: recent,
    };
  }, [orders]);

  const displayName = agentProfile?.display_name || userProfile?.full_name || 'Agent';

  /* --- Quick Action Cards --- */
  const cards = isSubAgent
    ? [
        { id: 'visit_storefront', title: 'Visit Storefront', desc: 'View Your Public Catalog', icon: <ShoppingBag size={20} />, accent: '#61D6F6', action: () => handleNav(storefrontUrl) },
        { id: 'wallet', title: 'Wallet', desc: 'Manage Your Balances', icon: <Wallet size={20} />, accent: '#7BE0C3', action: () => handleNav('/wallet') },
        { id: 'messenger', title: 'Messenger', desc: 'Chat With Researchers', icon: <MessageSquare size={20} />, accent: '#8FA8F6', action: () => handleNav('/messenger') },
        { id: 'lab_journal', title: 'Lab Journal', desc: 'Track Your Protocols', icon: <BookOpen size={20} />, accent: '#F6C761', action: () => handleNav('/lab-journal') },
        { id: 'orders', title: 'Orders', desc: 'View And Manage Orders', icon: <ClipboardList size={20} />, accent: '#61D6F6', action: () => onNavigate?.('Orders') },
        { id: 'research_library', title: 'Research Library', desc: 'Access Research Data', icon: <FlaskConical size={20} />, accent: '#C09EF6', action: () => handleNav('/research') },
        { id: 'products', title: 'Store Products', desc: 'View Retail Catalog', icon: <PackageSearch size={20} />, accent: '#F69ECB', action: () => onNavigate?.('Store Products') },
        { id: 'account_settings', title: 'Account Settings', desc: 'Update Profile Details', icon: <Settings size={20} />, accent: 'var(--silver, #A8B4C0)', action: () => handleNav('/account') },
        { id: 'researchers', title: 'Researchers', desc: 'Manage Your Customers', icon: <Users size={20} />, accent: '#7BD6D0', action: () => onNavigate?.('Researchers') },
        { id: 'lab_tools', title: 'Lab Tools', desc: 'Calculators And Utilities', icon: <Wrench size={20} />, accent: '#F6B061', action: () => handleNav('/lab-tools') },
        { id: 'sales', title: 'Sales And Accounting', desc: 'Financial Reports', icon: <TrendingUp size={20} />, accent: '#7BE08F', action: () => onNavigate?.('Sales & Accounting') },
        { id: 'help_support', title: 'Help And Support', desc: 'Get Assistance', icon: <HelpCircle size={20} />, accent: '#F68F8F', action: () => handleNav('/dashboard/agent/help') },
      ]
    : [
        { id: 'visit_storefront', title: 'Visit Storefront', desc: 'View Your Public Catalog', icon: <ShoppingBag size={20} />, accent: '#61D6F6', action: () => handleNav(storefrontUrl) },
        { id: 'wallet', title: 'Wallet', desc: 'Manage Your Balances', icon: <Wallet size={20} />, accent: '#7BE0C3', action: () => handleNav('/wallet') },
        { id: 'messenger', title: 'Messenger', desc: 'Chat With Researchers', icon: <MessageSquare size={20} />, accent: '#8FA8F6', action: () => handleNav('/messenger') },
        { id: 'lab_journal', title: 'Lab Journal', desc: 'Track Your Protocols', icon: <BookOpen size={20} />, accent: '#F6C761', action: () => handleNav('/lab-journal') },
        { id: 'orders', title: 'Orders', desc: 'View And Manage Orders', icon: <ClipboardList size={20} />, accent: '#61D6F6', action: () => onNavigate?.('Orders') },
        { id: 'storefront_config', title: 'Storefront Config', desc: 'Customize Your Store', icon: <Store size={20} />, accent: '#F68FB4', action: () => onNavigate?.('Storefront Config') },
        { id: 'products', title: 'Store Products', desc: 'Manage Your Catalog', icon: <PackageSearch size={20} />, accent: '#F69ECB', action: () => onNavigate?.('Store Products') },
        { id: 'my_agents', title: userProfile?.is_super_agent ? 'My Agent Accounts' : 'My Sub-Agents', desc: 'Manage Your Downline', icon: <Users2 size={20} />, accent: '#D69EF6', action: () => onNavigate?.(userProfile?.is_super_agent ? 'My Agent Accounts' : 'My Sub-Agents') },
        { id: 'researchers', title: 'Researchers', desc: 'Manage Your Customers', icon: <Users size={20} />, accent: '#7BD6D0', action: () => onNavigate?.('Researchers') },
        { id: 'inventory', title: 'Inventory', desc: 'Stock And Availability', icon: <Inbox size={20} />, accent: '#61C7F6', action: () => onNavigate?.('Inventory') },
        { id: 'sales', title: 'Sales And Accounting', desc: 'Financial Reports', icon: <TrendingUp size={20} />, accent: '#7BE08F', action: () => onNavigate?.('Sales & Accounting') },
        { id: 'research_library', title: 'Research Library', desc: 'Access Research Data', icon: <FlaskConical size={20} />, accent: '#C09EF6', action: () => handleNav('/research') },
        { id: 'coupons', title: 'Coupons', desc: 'Manage Discounts', icon: <Ticket size={20} />, accent: '#F6E061', action: () => onNavigate?.('Coupons') },
        { id: 'account_settings', title: 'Account Settings', desc: 'Update Profile Details', icon: <Settings size={20} />, accent: 'var(--silver, #A8B4C0)', action: () => handleNav('/account') },
        { id: 'lab_tools', title: 'Lab Tools', desc: 'Calculators And Utilities', icon: <Wrench size={20} />, accent: '#F6B061', action: () => handleNav('/lab-tools') },
        { id: 'help_support', title: 'Help And Support', desc: 'Get Assistance', icon: <HelpCircle size={20} />, accent: '#F68F8F', action: () => handleNav('/dashboard/agent/help') },
      ];

  const kpis = [
    {
      id: 'today_revenue',
      label: "Today's Revenue",
      value: currency.format(todayRevenue),
      icon: <DollarSign size={44} />,
      accent: '#7BE08F',
      footer: `Total Collected: ${currency.format(totalRevenue)}`,
      onClick: () => onNavigate?.('Sales & Accounting'),
    },
    {
      id: 'needs_approval',
      label: 'Needs Your Approval',
      value: String(needsApprovalCount),
      icon: <AlertCircle size={44} />,
      accent: needsApprovalCount > 0 ? '#F6A461' : 'var(--grey-400, #8090A0)',
      footer: `${activeOrdersCount} Active Orders Total`,
      onClick: () => onNavigate?.('Orders'),
      urgent: needsApprovalCount > 0,
    },
    {
      id: 'awaiting_payment',
      label: 'Awaiting Payment',
      value: String(awaitingPaymentCount),
      icon: <Hourglass size={44} />,
      accent: '#F6C761',
      footer: 'Customer Payment Pending',
      onClick: () => onNavigate?.('Orders'),
    },
    {
      id: 'researchers',
      label: 'Active Researchers',
      value: String(activeResearchersCount),
      icon: <Users size={44} />,
      accent: '#61D6F6',
      footer: 'In Your Network',
      onClick: () => onNavigate?.('Researchers'),
    },
  ];

  return (
    <div className="aoc-wrap">
      {/* Header And Storefront Link */}
      <div className="aoc-header">
        <div>
          <h1 className="aoc-title">Agent Action Center</h1>
          <p className="aoc-subtitle">Welcome Back, {displayName}.</p>
        </div>

        {storefrontUrl ? (
          <div className="aoc-link-pill">
            <span className="aoc-link-url">{storefrontUrl.replace(/^https?:\/\//, '')}</span>
            <button
              type="button"
              onClick={copyStorefrontLink}
              className="aoc-copy-btn"
              title="Copy Storefront Link"
              aria-label="Copy Storefront Link"
            >
              {copiedStorefront ? <Check size={16} style={{ color: '#7BE08F' }} /> : <Copy size={16} />}
            </button>
          </div>
        ) : null}
      </div>

      {/* Live KPI Grid */}
      <div className="aoc-kpi-grid">
        {kpis.map((kpi) => (
          <button
            type="button"
            key={kpi.id}
            className={`aoc-kpi${kpi.urgent ? ' aoc-kpi-urgent' : ''}`}
            onClick={kpi.onClick}
          >
            <div className="aoc-kpi-icon" style={{ color: kpi.accent }}>
              {kpi.icon}
            </div>
            <span className="aoc-kpi-label">{kpi.label}</span>
            <span className="aoc-kpi-value">{kpi.value}</span>
            <span className="aoc-kpi-footer" style={kpi.id === 'today_revenue' ? { color: '#7BE08F' } : undefined}>
              {kpi.footer}
            </span>
          </button>
        ))}
      </div>

      <div className="aoc-columns">
        {/* Recent Activity Feed */}
        <div className="aoc-panel">
          <div className="aoc-panel-head">
            <h2 className="aoc-panel-title">Recent Activity</h2>
            {recentOrders.length > 0 && (
              <button type="button" className="aoc-view-all" onClick={() => onNavigate?.('Orders')}>
                View All Orders
              </button>
            )}
          </div>

          {recentOrders.length === 0 ? (
            <div className="aoc-empty">
              <ClipboardList size={28} style={{ opacity: 0.4 }} />
              <p>No Orders Yet. Share Your Storefront Link To Get Started.</p>
            </div>
          ) : (
            <div className="aoc-feed">
              {recentOrders.map((o) => {
                const meta = STATUS_META[o.status] || { label: o.status, color: 'var(--grey-400, #8090A0)', bg: 'rgba(128, 144, 160, 0.12)' };
                return (
                  <button
                    type="button"
                    key={o.id}
                    className="aoc-feed-row"
                    onClick={() => onNavigate?.('Orders')}
                  >
                    <div className="aoc-feed-main">
                      <span className="aoc-feed-buyer">{o.buyer_name || o.buyer_email || 'Researcher'}</span>
                      <span className="aoc-feed-time">{timeAgo(o.created_at)}</span>
                    </div>
                    <div className="aoc-feed-side">
                      <span className="aoc-status-pill" style={{ color: meta.color, background: meta.bg }}>
                        {meta.label}
                      </span>
                      <span className="aoc-feed-total">{currency.format(Number(o.total) || 0)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions Grid */}
        <div className="aoc-panel aoc-panel-actions">
          <div className="aoc-panel-head">
            <h2 className="aoc-panel-title">Quick Actions</h2>
          </div>
          <div className="aoc-actions-grid">
            {cards.map((card) => (
              <button type="button" key={card.id} onClick={card.action} className="aoc-action-card">
                <div className="aoc-action-icon" style={{ color: card.accent }}>
                  {card.icon}
                </div>
                <span className="aoc-action-title">{card.title}</span>
                <span className="aoc-action-desc">{card.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .aoc-wrap {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-8) var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .aoc-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
        }
        .aoc-title {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary, #FFFFFF);
          margin: 0;
        }
        .aoc-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted, #8090A0);
          margin: var(--space-1) 0 0;
        }
        .aoc-link-pill {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--surface-1, #0F1923);
          border: var(--border-subtle, 1px solid rgba(255,255,255,0.05));
          border-radius: var(--radius-md, 8px);
          padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
          max-width: 100%;
          overflow: hidden;
        }
        .aoc-link-url {
          font-size: 0.8125rem;
          color: var(--text-secondary, #A8B4C0);
          text-transform: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 320px;
        }
        .aoc-copy-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-2);
          border: none;
          border-radius: var(--radius-sm, 4px);
          background: transparent;
          color: var(--text-secondary, #A8B4C0);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          flex-shrink: 0;
        }
        .aoc-copy-btn:hover {
          background: var(--surface-3, #1D2D3E);
          color: var(--text-primary, #FFFFFF);
        }
        .aoc-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: var(--space-4);
        }
        .aoc-kpi {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: var(--space-5);
          background: linear-gradient(145deg, var(--surface-2, #162230) 0%, var(--surface-1, #0F1923) 100%);
          border: var(--border-subtle, 1px solid rgba(255,255,255,0.05));
          border-radius: var(--radius-lg, 12px);
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          font-family: inherit;
        }
        .aoc-kpi:hover {
          border-color: rgba(168, 180, 192, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        }
        .aoc-kpi:focus-visible,
        .aoc-action-card:focus-visible,
        .aoc-feed-row:focus-visible {
          outline: 2px solid var(--teal, #00C4BC);
          outline-offset: 2px;
        }
        .aoc-kpi-urgent {
          border-color: rgba(246, 164, 97, 0.45);
        }
        .aoc-kpi-icon {
          position: absolute;
          top: var(--space-3);
          right: var(--space-3);
          opacity: 0.14;
          transition: opacity 0.2s ease;
        }
        .aoc-kpi:hover .aoc-kpi-icon { opacity: 0.28; }
        .aoc-kpi-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-muted, #8090A0);
          margin-bottom: var(--space-2);
        }
        .aoc-kpi-value {
          font-size: 1.875rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary, #FFFFFF);
          line-height: 1.1;
        }
        .aoc-kpi-footer {
          margin-top: var(--space-4);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted, #8090A0);
        }
        .aoc-columns {
          display: grid;
          grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
          gap: var(--space-4);
          align-items: start;
        }
        @media (max-width: 900px) {
          .aoc-columns { grid-template-columns: 1fr; }
        }
        .aoc-panel {
          background: var(--surface-1, #0F1923);
          border: var(--border-subtle, 1px solid rgba(255,255,255,0.05));
          border-radius: var(--radius-lg, 12px);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          min-width: 0;
        }
        .aoc-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
        }
        .aoc-panel-title {
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text-primary, #FFFFFF);
          margin: 0;
        }
        .aoc-view-all {
          background: transparent;
          border: none;
          color: var(--teal, #00C4BC);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm, 4px);
          transition: background 0.15s ease;
          font-family: inherit;
        }
        .aoc-view-all:hover { background: var(--teal-subtle, rgba(192, 184, 168, 0.08)); }
        .aoc-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-8) var(--space-4);
          color: var(--text-muted, #8090A0);
          font-size: 0.875rem;
          text-align: center;
        }
        .aoc-empty p { margin: 0; }
        .aoc-feed {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .aoc-feed-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-3);
          background: var(--surface-2, #162230);
          border: 1px solid transparent;
          border-radius: var(--radius-md, 8px);
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
          font-family: inherit;
          text-align: left;
          min-width: 0;
        }
        .aoc-feed-row:hover {
          border-color: rgba(168, 180, 192, 0.25);
          background: var(--surface-3, #1D2D3E);
        }
        .aoc-feed-main {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .aoc-feed-buyer {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary, #FFFFFF);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }
        .aoc-feed-time {
          font-size: 0.6875rem;
          color: var(--text-muted, #8090A0);
        }
        .aoc-feed-side {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
        }
        .aoc-status-pill {
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          padding: 3px 8px;
          border-radius: var(--radius-full, 9999px);
          white-space: nowrap;
        }
        .aoc-feed-total {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-primary, #FFFFFF);
          font-variant-numeric: tabular-nums;
        }
        .aoc-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: var(--space-3);
        }
        .aoc-action-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-1);
          padding: var(--space-4);
          background: var(--surface-2, #162230);
          border: 1px solid transparent;
          border-radius: var(--radius-md, 8px);
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
          font-family: inherit;
          text-align: left;
          min-width: 0;
        }
        .aoc-action-card:hover {
          border-color: rgba(168, 180, 192, 0.3);
          background: var(--surface-3, #1D2D3E);
          transform: translateY(-1px);
        }
        .aoc-action-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-2);
          border-radius: var(--radius-md, 8px);
          background: var(--surface-1, #0F1923);
          border: var(--border-subtle, 1px solid rgba(255,255,255,0.05));
          margin-bottom: var(--space-2);
          transition: transform 0.15s ease;
        }
        .aoc-action-card:hover .aoc-action-icon { transform: scale(1.08); }
        .aoc-action-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text-primary, #FFFFFF);
          line-height: 1.25;
        }
        .aoc-action-desc {
          font-size: 0.6875rem;
          color: var(--text-muted, #8090A0);
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media (max-width: 640px) {
          .aoc-wrap { padding: var(--space-6) var(--space-3); }
          .aoc-kpi-value { font-size: 1.5rem; }
          .aoc-link-url { max-width: 200px; }
        }
      ` }} />
    </div>
  );
}
