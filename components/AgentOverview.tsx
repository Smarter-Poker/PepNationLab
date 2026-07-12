import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  AlertCircle,
  Hourglass,
  Users,
  Users2,
  Activity,
  Copy,
  Check,
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
  activeAgentsCount?: number;
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
  activeAgentsCount = 0,
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
  const { todayRevenue, needsApprovalCount, awaitingPaymentCount, recentCount, latestActivity } = useMemo(() => {
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

    const sorted = [...(orders || [])]
      .filter((o) => o.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      todayRevenue: tRev,
      needsApprovalCount: approval,
      awaitingPaymentCount: awaiting,
      recentCount: sorted.length,
      latestActivity: sorted[0]?.created_at ?? null,
    };
  }, [orders]);

  /* --- Metallic menu image + click zones (restored, role-aware) --- */
  const cardZones = isSubAgent ? [
    // --- SUB-AGENT (6 Rows) ---
    // Left Column
    { id: 'visit_storefront', label: 'Visit Storefront', left: '4%', width: '44.5%', top: '3%', height: '14.5%', action: () => handleNav(storefrontUrl) },
    { id: 'messenger', label: 'Messenger', left: '4%', width: '44.5%', top: '19%', height: '14.5%', action: () => handleNav('/messenger') },
    { id: 'orders', label: 'Orders', left: '4%', width: '44.5%', top: '35%', height: '14.5%', action: () => onNavigate?.('Orders') },
    { id: 'products', label: 'Store Products', left: '4%', width: '44.5%', top: '51%', height: '14.5%', action: () => onNavigate?.('Store Products') },
    { id: 'researchers', label: 'Researchers', left: '4%', width: '44.5%', top: '67%', height: '14.5%', action: () => onNavigate?.('Researchers') },
    { id: 'sales', label: 'Sales And Accounting', left: '4%', width: '44.5%', top: '83%', height: '14.5%', action: () => onNavigate?.('Sales & Accounting') },
    // Right Column
    { id: 'wallet', label: 'Wallet', left: '51.5%', width: '44.5%', top: '3%', height: '14.5%', action: () => handleNav('/wallet') },
    { id: 'lab_journal', label: 'Lab Journal', left: '51.5%', width: '44.5%', top: '19%', height: '14.5%', action: () => handleNav('/lab-journal') },
    { id: 'research_library', label: 'Research Library', left: '51.5%', width: '44.5%', top: '35%', height: '14.5%', action: () => handleNav('/research') },
    { id: 'account_settings', label: 'Account Settings', left: '51.5%', width: '44.5%', top: '51%', height: '14.5%', action: () => handleNav('/account') },
    { id: 'lab_tools', label: 'Lab Tools', left: '51.5%', width: '44.5%', top: '67%', height: '14.5%', action: () => handleNav('/lab-tools') },
    { id: 'help_support', label: 'Help And Support', left: '51.5%', width: '44.5%', top: '83%', height: '14.5%', action: () => handleNav('/dashboard/agent/help') },
  ] : [
    // --- AGENT / SUPER AGENT (8 Rows) ---
    // LEFT COLUMN
    { id: 'visit_storefront', label: 'Visit Storefront', left: '4%', width: '44.5%', top: '3%', height: '10.5%', action: () => handleNav(storefrontUrl) },
    { id: 'messenger', label: 'Messenger', left: '4%', width: '44.5%', top: '15%', height: '10.5%', action: () => handleNav('/messenger') },
    { id: 'orders', label: 'Orders', left: '4%', width: '44.5%', top: '27%', height: '10.5%', action: () => onNavigate?.('Orders') },
    { id: 'products', label: 'Store Products', left: '4%', width: '44.5%', top: '39%', height: '10.5%', action: () => onNavigate?.('Store Products') },
    { id: 'researchers', label: 'Researchers', left: '4%', width: '44.5%', top: '51%', height: '10.5%', action: () => onNavigate?.('Researchers') },
    { id: 'sales', label: 'Sales And Accounting', left: '4%', width: '44.5%', top: '63%', height: '10.5%', action: () => onNavigate?.('Sales & Accounting') },
    { id: 'coupons', label: 'Coupons', left: '4%', width: '44.5%', top: '75%', height: '10.5%', action: () => onNavigate?.('Coupons') },
    { id: 'lab_tools', label: 'Lab Tools', left: '4%', width: '44.5%', top: '87%', height: '10.5%', action: () => handleNav('/lab-tools') },
    // RIGHT COLUMN
    { id: 'wallet', label: 'Wallet', left: '51.5%', width: '44.5%', top: '3%', height: '10.5%', action: () => handleNav('/wallet') },
    { id: 'lab_journal', label: 'Lab Journal', left: '51.5%', width: '44.5%', top: '15%', height: '10.5%', action: () => handleNav('/lab-journal') },
    { id: 'storefront_config', label: 'Storefront Config', left: '51.5%', width: '44.5%', top: '27%', height: '10.5%', action: () => onNavigate?.('Storefront Config') },
    { id: 'my_agents', label: 'My Agent Accounts', left: '51.5%', width: '44.5%', top: '39%', height: '10.5%', action: () => onNavigate?.(userProfile?.is_super_agent ? 'My Agent Accounts' : 'My Sub-Agents') },
    { id: 'inventory', label: 'Inventory', left: '51.5%', width: '44.5%', top: '51%', height: '10.5%', action: () => onNavigate?.('Inventory') },
    { id: 'research_library', label: 'Research Library', left: '51.5%', width: '44.5%', top: '63%', height: '10.5%', action: () => handleNav('/research') },
    { id: 'account_settings', label: 'Account Settings', left: '51.5%', width: '44.5%', top: '75%', height: '10.5%', action: () => handleNav('/account') },
    { id: 'help_support', label: 'Help And Support', left: '51.5%', width: '44.5%', top: '87%', height: '10.5%', action: () => onNavigate?.('/dashboard/agent/help') },
  ];

  const heroImage = isSubAgent ? '/images/sub-agent-dashboard.png' : '/images/agent-dashboard-16.png';

  return (
    <div className="aoc-wrap">
      {/* Header (title only — Welcome-Back line removed per spec) + Storefront link */}
      <div className="aoc-header">
        <h1 className="aoc-title">Agent Action Center</h1>

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

      {/* Five equal KPI boxes */}
      <div className="aoc-kpi-grid">
        {/* 1. Today's Revenue */}
        <button type="button" className="aoc-kpi" onClick={() => onNavigate?.('Sales & Accounting')}>
          <div className="aoc-kpi-icon" style={{ color: '#7BE08F' }}><DollarSign size={40} /></div>
          <span className="aoc-kpi-label">Today&apos;s Revenue</span>
          <span className="aoc-kpi-value">{currency.format(todayRevenue)}</span>
          <span className="aoc-kpi-footer" style={{ color: '#7BE08F' }}>Total Collected: {currency.format(totalRevenue)}</span>
        </button>

        {/* 2. Needs Your Approval */}
        <button
          type="button"
          className={`aoc-kpi${needsApprovalCount > 0 ? ' aoc-kpi-urgent' : ''}`}
          onClick={() => onNavigate?.('Orders')}
        >
          <div className="aoc-kpi-icon" style={{ color: needsApprovalCount > 0 ? '#F6A461' : 'var(--grey-400, #8090A0)' }}><AlertCircle size={40} /></div>
          <span className="aoc-kpi-label">Needs Your Approval</span>
          <span className="aoc-kpi-value">{needsApprovalCount}</span>
          <span className="aoc-kpi-footer">{activeOrdersCount} Active Orders Total</span>
        </button>

        {/* 3. Awaiting Payment */}
        <button type="button" className="aoc-kpi" onClick={() => onNavigate?.('Orders')}>
          <div className="aoc-kpi-icon" style={{ color: '#F6C761' }}><Hourglass size={40} /></div>
          <span className="aoc-kpi-label">Awaiting Payment</span>
          <span className="aoc-kpi-value">{awaitingPaymentCount}</span>
          <span className="aoc-kpi-footer">Customer Payment Pending</span>
        </button>

        {/* 4. Active Agents & Active Researchers (combined) */}
        <button type="button" className="aoc-kpi aoc-kpi-split" onClick={() => onNavigate?.(userProfile?.is_super_agent ? 'My Agent Accounts' : 'Researchers')}>
          <div className="aoc-kpi-icon" style={{ color: '#61D6F6' }}><Users size={40} /></div>
          <div className="aoc-split-row">
            <div className="aoc-split-cell">
              <span className="aoc-split-value">{activeAgentsCount}</span>
              <span className="aoc-split-label">Active Agents</span>
            </div>
            <div className="aoc-split-divider" />
            <div className="aoc-split-cell">
              <span className="aoc-split-value">{activeResearchersCount}</span>
              <span className="aoc-split-label">Active Researchers</span>
            </div>
          </div>
          <span className="aoc-kpi-footer">In Your Network</span>
        </button>

        {/* 5. Recent Activity */}
        <button type="button" className="aoc-kpi" onClick={() => onNavigate?.('Orders')}>
          <div className="aoc-kpi-icon" style={{ color: '#C09EF6' }}><Activity size={40} /></div>
          <span className="aoc-kpi-label">Recent Activity</span>
          <span className="aoc-kpi-value">{recentCount}</span>
          <span className="aoc-kpi-footer">{latestActivity ? `Last: ${timeAgo(latestActivity)}` : 'No Orders Yet'}</span>
        </button>
      </div>

      {/* Metallic menu image with clickable zones (restored) */}
      <div className="dash-hero-wrap">
        <div className="dash-hero" style={{ backgroundImage: `url('${heroImage}')` }}>
          {cardZones.map((zone) => (
            <div
              key={zone.id}
              className="dash-zone"
              onClick={zone.action}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') zone.action();
              }}
              aria-label={zone.label}
              style={{ left: zone.left, width: zone.width, top: zone.top, height: zone.height }}
            />
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .aoc-wrap {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-8, 32px) var(--space-4, 16px);
          display: flex;
          flex-direction: column;
          gap: var(--space-6, 24px);
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .aoc-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4, 16px);
        }
        .aoc-title {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary, #FFFFFF);
          margin: 0;
        }
        .aoc-link-pill {
          display: flex;
          align-items: center;
          gap: var(--space-2, 8px);
          background: var(--surface-1, #0F1923);
          border: var(--border-subtle, 1px solid rgba(255,255,255,0.05));
          border-radius: var(--radius-md, 8px);
          padding: var(--space-2, 8px) var(--space-2, 8px) var(--space-2, 8px) var(--space-3, 12px);
          max-width: 100%;
          overflow: hidden;
        }
        .aoc-link-url {
          font-size: 0.8125rem;
          color: var(--text-secondary, #A8B4C0);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 320px;
        }
        .aoc-copy-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-2, 8px);
          border: none;
          border-radius: var(--radius-sm, 4px);
          background: transparent;
          color: var(--text-secondary, #A8B4C0);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          flex-shrink: 0;
        }
        .aoc-copy-btn:hover { background: var(--surface-3, #1D2D3E); color: var(--text-primary, #FFFFFF); }

        /* Five equal boxes */
        .aoc-kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: var(--space-4, 16px);
        }
        @media (max-width: 1024px) { .aoc-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 640px)  { .aoc-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

        .aoc-kpi {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: var(--space-5, 20px);
          background: linear-gradient(145deg, var(--surface-2, #162230) 0%, var(--surface-1, #0F1923) 100%);
          border: var(--border-subtle, 1px solid rgba(255,255,255,0.05));
          border-radius: var(--radius-lg, 12px);
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          font-family: inherit;
          min-height: 132px;
        }
        .aoc-kpi:hover {
          border-color: rgba(168, 180, 192, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        }
        .aoc-kpi:focus-visible,
        .dash-zone:focus-visible {
          outline: 2px solid var(--teal, #00C4BC);
          outline-offset: 2px;
        }
        .aoc-kpi-urgent { border-color: rgba(246, 164, 97, 0.45); }
        .aoc-kpi-icon {
          position: absolute;
          top: var(--space-3, 12px);
          right: var(--space-3, 12px);
          opacity: 0.14;
          transition: opacity 0.2s ease;
        }
        .aoc-kpi:hover .aoc-kpi-icon { opacity: 0.28; }
        .aoc-kpi-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-muted, #8090A0);
          margin-bottom: var(--space-2, 8px);
        }
        .aoc-kpi-value {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary, #FFFFFF);
          line-height: 1.1;
        }
        .aoc-kpi-footer {
          margin-top: auto;
          padding-top: var(--space-3, 12px);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted, #8090A0);
        }

        /* Combined Agents + Researchers box */
        .aoc-kpi-split .aoc-split-row {
          display: flex;
          align-items: stretch;
          gap: var(--space-2, 8px);
          width: 100%;
        }
        .aoc-split-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .aoc-split-value {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary, #FFFFFF);
          line-height: 1.1;
        }
        .aoc-split-label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--text-muted, #8090A0);
          white-space: nowrap;
        }
        .aoc-split-divider {
          width: 1px;
          align-self: stretch;
          background: rgba(255,255,255,0.08);
          margin: 0 var(--space-1, 4px);
        }

        /* -- Metallic menu image -- */
        .dash-hero-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }
        .dash-hero {
          position: relative;
          flex-shrink: 0;
          width: calc(100% - 4px);
          max-width: 480px;
          aspect-ratio: 941 / 1672;
          overflow: hidden;
          background-repeat: no-repeat;
          background-position: top left;
          background-size: 100% 100%;
          border-radius: 10px;
        }
        .dash-zone {
          position: absolute;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.15s ease;
          z-index: 2;
          -webkit-tap-highlight-color: transparent;
          outline: none;
        }
        .dash-zone:hover  { background: rgba(255, 255, 255, 0.05); }
        .dash-zone:active { background: rgba(255, 255, 255, 0.12); }
        @media (hover: none) { .dash-zone:hover { background: transparent; } }
      ` }} />
    </div>
  );
}
