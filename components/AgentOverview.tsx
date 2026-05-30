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
   * Layout math:
   *   background-size: auto 130%  →  image rendered at 130% of container height.
   *   Container shows top (100 / 130) = 76.9% of the image.
   *   The 6 nav rows occupy the top 77% of the image → they fill the screen exactly.
   *   The "Share Your Storefront" section (77-100%) is clipped off by overflow:hidden.
   *
   * Click zone positions must be scaled by 1.3 to convert image-% → container-%:
   *   image top T%  →  container top = T × 1.3 %
   *   image height H%  →  container height = H × 1.3 %
   */
  const cardZones = [
    {
      id: 'storefront',
      top: '1.3%', height: '14.3%',
      action: () => window.open(storefrontUrl, '_blank', 'noopener,noreferrer'),
    },
    {
      id: 'researchers',
      top: '18.2%', height: '14.3%',
      action: () => onNavigate?.('Researchers'),
    },
    {
      id: 'inventory',
      top: '35.1%', height: '14.3%',
      action: () => onNavigate?.('Inventory'),
    },
    {
      id: 'products',
      top: '52.0%', height: '14.3%',
      action: () => onNavigate?.('Store Products'),
    },
    {
      id: 'sales',
      top: '68.9%', height: '14.3%',
      action: () => onNavigate?.('Sales & Carts'),
    },
    {
      id: 'orders',
      top: '85.8%', height: '14.3%',
      action: () => onNavigate?.('Orders'),
    },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .dash-hero {
          position: relative;
          width: 100%;
          /* Full viewport height minus the top nav bar (64 px) */
          height: calc(100dvh - 64px);
          min-height: 350px;
          overflow: hidden;

          /*
           * Background image at 130% of container height, top-anchored.
           * This shows only the top 77 % (= 100/130) of the image —
           * exactly the 6 nav-row cards — and clips the rest.
           */
          background-image: url('/images/agent-dashboard-nav.jpg');
          background-repeat: no-repeat;
          background-position: top center;
          background-size: auto 130%;
        }

        .dash-zone {
          position: absolute;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.15s ease;
          z-index: 2;
        }
        .dash-zone:hover  { background: rgba(255, 255, 255, 0.04); }
        .dash-zone:active { background: rgba(255, 255, 255, 0.08); }
      `}} />

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
            style={{
              top: zone.top,
              left: '2%',
              width: '96%',
              height: zone.height,
            }}
          />
        ))}
      </div>
    </>
  );
}
