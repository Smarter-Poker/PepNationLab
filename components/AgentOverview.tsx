import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  AlertCircle,
  Hourglass,
  Users,
  Activity,
  Copy,
  Check,
  FlaskConical,
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
    { id: 'help_support', label: 'Help And Support', left: '51.5%', width: '44.5%', top: '87%', height: '10.5%', action: () => handleNav('/dashboard/agent/help') },
  ];

  const heroImage = isSubAgent ? '/images/sub-agent-dashboard.png' : '/images/agent-dashboard-16.png';

  return (
    <div className="aoc-wrap">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f4f5f7" />
            <stop offset="25%" stopColor="#d1d6dc" />
            <stop offset="50%" stopColor="#7a8591" />
            <stop offset="51%" stopColor="#96a2ae" />
            <stop offset="100%" stopColor="#c8d0d8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="aoc-header" style={{ justifyContent: 'center', marginBottom: '8px' }}>
        <h1 className="aoc-title metal-text" style={{ fontSize: '2rem' }}>Agent Dashboard</h1>
      </div>
      {/* Three KPI boxes embedded in a metallic frame */}
      <div className="aoc-kpi-frame">
        <div className="aoc-kpi-inner">
          <div className="aoc-kpi-grid">
            {/* 1. Today's Revenue */}
            <button type="button" className="aoc-kpi-panel" onClick={() => onNavigate?.('Sales & Accounting')}>
              <div className="aoc-kpi-left">
                <div className="metal-icon-text">$</div>
              </div>
              <div className="aoc-kpi-separator" />
              <div className="aoc-kpi-right">
                <div className="aoc-kpi-title metal-text">TODAY&apos;S REVENUE</div>
                <div className="aoc-kpi-amount metal-text-large">{currency.format(todayRevenue)}</div>
                <div className="aoc-kpi-subtitle metal-text-dim">Total Collected: {currency.format(totalRevenue)}</div>
              </div>
            </button>

            {/* 2. Recent Activity (Combined) */}
            <button type="button" className="aoc-kpi-panel" onClick={() => onNavigate?.('Orders')}>
              <div className="aoc-kpi-left">
                <Activity stroke="url(#metalGrad)" strokeWidth={1.5} size={72} style={{ filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.8))' }} />
              </div>
              <div className="aoc-kpi-separator" />
              <div className="aoc-kpi-right">
                <div className="aoc-kpi-title metal-text">RECENT ACTIVITY</div>
                <div className="aoc-kpi-stat">
                  <span className="metal-text-large stat-num">{awaitingPaymentCount}</span>
                  <span className="metal-text-dim">Awaiting Payment</span>
                </div>
                <div className="aoc-kpi-stat" style={{ marginTop: '6px' }}>
                  <span className="metal-text-large stat-num">{recentCount}</span>
                  <span className="metal-text-dim">Recent Orders</span>
                </div>
              </div>
            </button>

            {/* 3. Active Agents & Active Researchers (stacked) */}
            <div className="aoc-kpi-panel aoc-kpi-panel-split">
              <div 
                className="aoc-kpi-row clickable-row" 
                onClick={() => onNavigate?.(userProfile?.is_super_agent ? 'My Agent Accounts' : 'My Sub-Agents')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate?.(userProfile?.is_super_agent ? 'My Agent Accounts' : 'My Sub-Agents'); }}
              >
                <div className="aoc-kpi-left-small">
                  <Users stroke="url(#metalGrad)" strokeWidth={1.5} size={56} style={{ filter: 'drop-shadow(0px 3px 3px rgba(0,0,0,0.8))' }} />
                </div>
                <div className="aoc-kpi-separator-small" />
                <div className="aoc-kpi-right-row">
                  <span className="metal-text-large row-num">{activeAgentsCount}</span>
                  <span className="metal-text row-label">AGENTS</span>
                </div>
              </div>
              <div className="aoc-kpi-divider-h" />
              <div 
                className="aoc-kpi-row clickable-row" 
                style={{ marginTop: '16px' }}
                onClick={() => onNavigate?.('Researchers')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate?.('Researchers'); }}
              >
                <div className="aoc-kpi-left-small dynamic-flask">
                  <FlaskConical stroke="url(#metalGrad)" strokeWidth={1.5} size={56} />
                </div>
                <div className="aoc-kpi-separator-small" />
                <div className="aoc-kpi-right-row">
                  <span className="metal-text-large row-num">{activeResearchersCount}</span>
                  <span className="metal-text row-label">RESEARCHERS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
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

        /* Premium Metallic Frame */
        .aoc-kpi-frame {
          width: 100%;
          max-width: 480px;
          margin: 0 auto var(--space-4, 16px) auto;
          position: relative;
          border-radius: 14px;
          /* Thick brushed nickel background */
          background: linear-gradient(135deg, #e6e9ec 0%, #aeb6bf 25%, #6a7683 50%, #909ba7 75%, #d1d6dc 100%);
          padding: 8px; /* Thickness of the frame */
          box-shadow: 
            0 12px 30px rgba(0,0,0,0.6),
            inset 0 1px 3px rgba(255,255,255,0.8),
            inset 0 -1px 4px rgba(0,0,0,0.6);
        }
        .aoc-kpi-inner {
          background: #0A1016; /* Deep dark background matching the image inner */
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: inset 0 3px 8px rgba(0,0,0,0.9);
        }

        /* The 3 KPI boxes vertically stacked */
        .aoc-kpi-grid {
          display: flex;
          flex-direction: column;
          gap: var(--space-3, 12px);
          width: 100%;
        }

        /* Glossy Dark Button mimicking the dynamic image buttons */
        .aoc-kpi-panel {
          position: relative;
          display: flex;
          align-items: center; /* side by side */
          text-align: left;
          padding: 24px;
          
          /* Thin brushed nickel edge + slight background gradient */
          border: 1.5px solid transparent;
          background-image: 
            linear-gradient(180deg, #1C2732 0%, #0B1015 100%),
            linear-gradient(135deg, #d1d6dc 0%, #6a7683 25%, #3a4249 50%, #909ba7 75%, #e6e9ec 100%);
          background-origin: padding-box, border-box;
          background-clip: padding-box, border-box;

          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          min-height: 120px;
          min-width: 0;
          box-shadow: 
            0 8px 16px rgba(0,0,0,0.8),
            inset 0 1px 2px rgba(255,255,255,0.05);
          color: white;
        }
        .aoc-kpi-panel:hover {
          background-image: 
            linear-gradient(180deg, #243240 0%, #10171F 100%),
            linear-gradient(135deg, #e6e9ec 0%, #7a8591 25%, #4a5259 50%, #a0abb7 75%, #f4f5f7 100%);
        }
        
        .aoc-kpi-panel-split {
          flex-direction: column;
          align-items: stretch;
          padding: 16px 24px;
          cursor: default;
        }
        .aoc-kpi-panel-split:hover {
          background-image: 
            linear-gradient(180deg, #1C2732 0%, #0B1015 100%),
            linear-gradient(135deg, #d1d6dc 0%, #6a7683 25%, #3a4249 50%, #909ba7 75%, #e6e9ec 100%);
        }
        
        .aoc-kpi-left {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          flex-shrink: 0;
        }
        .aoc-kpi-left-small {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          flex-shrink: 0;
        }
        
        .aoc-kpi-separator {
          width: 2px;
          align-self: stretch;
          background: linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(255,255,255,0.05) 100%);
          margin: 0 24px;
        }
        .aoc-kpi-separator-small {
          width: 2px;
          align-self: stretch;
          background: linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(255,255,255,0.05) 100%);
          margin: 0 24px;
        }
        
        .aoc-kpi-right {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex-grow: 1;
          min-width: 0;
          overflow: hidden;
        }
        
        .aoc-kpi-row {
          display: flex;
          align-items: center;
        }
        .clickable-row {
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.15s ease;
          outline: none;
        }
        
        /* Flask: dynamic glow pulse — no movement */
        @keyframes flask-glow {
          0%, 100% { filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.8)) drop-shadow(0 0 4px rgba(45,212,191,0.15)); }
          50%       { filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.8)) drop-shadow(0 0 12px rgba(45,212,191,0.55)); }
        }
        .dynamic-flask svg {
          animation: flask-glow 3s ease-in-out infinite;
        }

        .clickable-row:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .clickable-row:active {
          background: rgba(255, 255, 255, 0.08);
        }
        .clickable-row:focus-visible {
          outline: 2px solid var(--teal, #00C4BC);
          outline-offset: 4px;
        }
        .aoc-kpi-right-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        
        .aoc-kpi-divider-h {
          height: 2px;
          width: 100%;
          background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(255,255,255,0.03) 100%);
          margin: 16px 0 0 0;
        }
        
        /* Metallic text styling */
        .metal-icon-text {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 80px;
          line-height: 1;
          font-weight: 500;
          background: linear-gradient(180deg, #f4f5f7 0%, #d1d6dc 25%, #7a8591 50%, #96a2ae 51%, #c8d0d8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.8));
          margin-top: -6px;
        }
        
        .metal-text {
          background: linear-gradient(180deg, #d4d9de 0%, #a2abb3 45%, #6a7683 55%, #c8d0d8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 1px 1px rgba(0,0,0,0.9));
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }
        .metal-text-large {
          background: linear-gradient(180deg, #ffffff 0%, #d1d6dc 45%, #96a2ae 55%, #f4f5f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.9));
          font-weight: 800;
        }
        .metal-text-dim {
          color: #8090A0;
          font-weight: 600;
          font-size: 0.875rem;
        }
        
        .aoc-kpi-title {
          font-size: 0.95rem;
          margin-bottom: 8px;
        }
        .aoc-kpi-amount {
          font-size: 2.75rem;
          line-height: 1;
          margin-bottom: 4px;
        }
        .aoc-kpi-subtitle {
          font-size: 0.85rem;
        }
        .aoc-kpi-stat {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .stat-num {
          font-size: 1.5rem;
          min-width: 20px;
          flex-shrink: 0;
        }
        .row-num {
          font-size: 2.25rem;
          line-height: 1;
          flex-shrink: 0;
        }
        .row-label {
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }

        /* ── Mobile responsive overrides ──────────────────────────── */
        @media (max-width: 480px) {
          .aoc-kpi-panel {
            padding: 14px 12px;
            min-height: 92px;
          }
          .aoc-kpi-panel-split {
            padding: 12px 14px;
          }
          /* Shrink the icon column */
          .aoc-kpi-left {
            width: 48px;
          }
          .aoc-kpi-left-small {
            width: 40px;
          }
          /* Tighten separator margins */
          .aoc-kpi-separator,
          .aoc-kpi-separator-small {
            margin: 0 10px;
          }
          /* Scale down the big $ icon */
          .metal-icon-text {
            font-size: 46px !important;
          }
          /* Scale down Lucide icons */
          .aoc-kpi-left svg,
          .aoc-kpi-left-small svg {
            width: 36px !important;
            height: 36px !important;
          }
          /* Scale down amount */
          .aoc-kpi-amount {
            font-size: 1.65rem;
          }
          /* Smaller title/subtitle text */
          .aoc-kpi-title {
            font-size: 0.75rem;
          }
          .aoc-kpi-subtitle {
            font-size: 0.7rem;
          }
          /* Row stats */
          .row-num { font-size: 1.5rem; }
          .row-label { font-size: 0.75rem; }
          .stat-num { font-size: 1.1rem; }
        }
        /* ─────────────────────────────────────────────────────────── */


        .aoc-kpi-panel:focus-visible,
        .dash-zone:focus-visible {
          outline: 2px solid var(--teal, #00C4BC);
          outline-offset: 2px;
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
