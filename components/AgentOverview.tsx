import React from 'react';
import { useRouter } from 'next/navigation';

interface AgentOverviewProps {
  activeResearchersCount: number;
  activeOrdersCount: number;
  totalRevenue: number;
  storefrontUrl: string;
  copyStorefrontLink: () => void;
  copiedStorefront: boolean;
  agentProfile: any;
  orders: any[];
  userProfile?: any;
  isSubAgent?: boolean;
  onNavigate?: (tab: string) => void;
}

export default function AgentOverview({
  storefrontUrl,
  agentProfile,
  userProfile,
  isSubAgent: explicitIsSubAgent,
  onNavigate,
}: AgentOverviewProps) {
  const router = useRouter();
  const isSubAgent = explicitIsSubAgent ?? (userProfile?.is_super_agent !== true);

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
      } catch (e) {
        // Fallback
      }
      window.location.href = href;
    } else {
      router.push(href);
    }
  };

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
    // --- SUPER AGENT (8 Rows) ---
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

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `

        /* -- Outer wrapper ------------------------------------------------ */
        .dash-hero-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;

          /* gap between global header and the image */
          padding-top: 20px;

          /* Dark fill visible on desktop beside the centered panel */
          background: #0a0a0a;
        }

        /* -- Hero panel --------------------------------------------------- *
         *
         * Width drives height (aspect-ratio derives height from width).
         * 4 px total horizontal inset (2 px each side) - shows full brushed-
         * nickel frame with minimal dark border.
         *
         * background-size: 100% 100% -> image fills the container exactly with
         * ZERO clipping because the container matches the image's own ratio.
         */
        .dash-hero {
          position: relative;
          flex-shrink: 0;

          /* 2 px gutter each side -> full visible frame */
          width: calc(100% - 4px);
          max-width: 480px;           /* cap on wide desktop */

          /* Height auto-calculated by browser: width x (1672/941) */
          aspect-ratio: 941 / 1672;

          overflow: hidden;

          background-image: url('${isSubAgent ? '/images/sub-agent-dashboard.png' : '/images/agent-dashboard-16.png'}');
          background-repeat: no-repeat;
          background-position: top left;
          background-size: 100% 100%;   /* pixel-perfect: container = image */
        }

        /* -- Click zones -------------------------------------------------- */
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

        @media (hover: none) {
          .dash-zone:hover { background: transparent; }
        }

      `}} />

      <div className="dash-hero-wrap">
        <div className="dash-hero">
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
    </>
  );
}
