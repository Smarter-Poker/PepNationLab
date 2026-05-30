import React from 'react';

interface AgentOverviewProps {
  activeResearchersCount: number;
  activeOrdersCount: number;
  totalRevenue: number;
  storefrontUrl: string;
  copyStorefrontLink: () => void;
  copiedStorefront: boolean;
  agentProfile: any;
  orders: any[];
  onNavigate?: (tab: string) => void;
}

export default function AgentOverview({
  storefrontUrl,
  onNavigate,
}: AgentOverviewProps) {
  /*
   * Image: agent-dashboard-nav.jpg — 576 × 1024 px (portrait, 9:16)
   *
   * Layout strategy:
   *  • Mobile  (≤480 px wide): background-size:cover fills height, image fills
   *    edge-to-edge. Vertical image % === container % because height is the
   *    cover dimension.
   *  • Desktop (>480 px): panel is capped at 480 px max-width and centered,
   *    background-size:cover still fills by width at that size, showing ~98 %
   *    of the image height — all 6 rows visible.
   *
   * Click zone calibration (measured from 576×1024 source):
   *   border top:  ~12 px  (1.2 %)
   *   each button: ~158 px (15.4 %)
   *   each gap:    ~10 px  (1.0 %)
   *
   *   Row 1  top:  1.2 %   Row 2  top: 17.6 %
   *   Row 3  top: 34.0 %   Row 4  top: 50.5 %
   *   Row 5  top: 66.9 %   Row 6  top: 83.3 %
   *   Each row height: 15.4 %
   */
  const cardZones = [
    {
      id: 'storefront',
      top: '1.2%', height: '15.4%',
      action: () => window.open(storefrontUrl, '_blank', 'noopener,noreferrer'),
    },
    {
      id: 'researchers',
      top: '17.6%', height: '15.4%',
      action: () => onNavigate?.('Researchers'),
    },
    {
      id: 'inventory',
      top: '34.0%', height: '15.4%',
      action: () => onNavigate?.('Inventory'),
    },
    {
      id: 'products',
      top: '50.5%', height: '15.4%',
      action: () => onNavigate?.('Store Products'),
    },
    {
      id: 'sales',
      top: '66.9%', height: '15.4%',
      action: () => onNavigate?.('Sales & Carts'),
    },
    {
      id: 'orders',
      top: '83.3%', height: '15.4%',
      action: () => onNavigate?.('Orders'),
    },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        /* ── Outer wrapper — expands full width so the panel can center ── */
        .dash-hero-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          background: var(--black);
          min-height: calc(100dvh - 64px);
        }

        /* ── Hero panel ── */
        .dash-hero {
          position: relative;
          width: 100%;
          max-width: 480px;          /* portrait panel width on desktop   */
          height: calc(100dvh - 64px);
          min-height: 500px;
          overflow: hidden;

          background-image: url('/images/agent-dashboard-nav.jpg');
          background-repeat: no-repeat;
          background-position: top center;
          background-size: cover;    /* fills by height on mobile ✓        */
        }

        /* ── Click zones ── */
        .dash-zone {
          position: absolute;
          left: 3%;
          width: 94%;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.15s ease;
          z-index: 2;
        }
        .dash-zone:hover  { background: rgba(255, 255, 255, 0.05); }
        .dash-zone:active { background: rgba(255, 255, 255, 0.10); }

        /* Touch devices — remove hover flicker */
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
              aria-label={zone.id}
              style={{ top: zone.top, height: zone.height }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
