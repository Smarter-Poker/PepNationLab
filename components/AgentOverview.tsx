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
   * THE PROBLEM with background-size:cover:
   *   On mobile Safari with browser chrome (URL bar + nav bar), the usable
   *   viewport height is only ~600-680px. At 390px wide, cover scales the image
   *   to fill WIDTH → rendered at 390×693px, but container is only ~604px →
   *   bottom ~90px (Row 6 + border) gets clipped.
   *
   * THE FIX — aspect-ratio + background-size: 100% 100%:
   *   Lock the container to the IMAGE'S own aspect ratio (576:1024).
   *   Height = 100dvh - 64px (nav).  Width = height × (576/1024) — derived by
   *   the browser from aspect-ratio.  background-size:100% 100% then maps the
   *   image pixel-perfect onto the container with ZERO clipping on any axis.
   *   Dark side bars appear on the parent (matching the dashboard background)
   *   when the viewport is wider than the panel — identical to how a phone app
   *   looks in landscape or on a desktop browser.
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
   *
   *   Because container IS the image (100% 100%), zone % = image % exactly.
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

        /* ── Outer wrapper ── */
        .dash-hero-wrap {
          width: 100%;
          min-height: calc(100dvh - 64px);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #0a0a0a;   /* dark fill visible on wide/desktop viewports */
        }

        /* ── Hero panel ──
         *
         *  Key trick: aspect-ratio + height → browser derives width.
         *  The panel is always exactly as wide as the portrait image needs to be
         *  to fill the viewport height — so background-size:100% 100% maps the
         *  image pixel-perfect with NO top/bottom OR left/right clipping.
         */
        .dash-hero {
          position: relative;
          flex-shrink: 0;

          /* Height = available viewport (minus nav bar) */
          height: calc(100dvh - 64px);
          min-height: 480px;

          /* Width is derived from height × (576/1024) by the browser */
          aspect-ratio: 576 / 1024;

          /* Never overflow the parent on very narrow screens */
          max-width: 100%;

          overflow: hidden;

          background-image: url('/images/agent-dashboard-nav.jpg');
          background-repeat: no-repeat;
          background-position: top left;
          /* 100% 100% = stretch to exactly fill this container.
             No cover/contain math needed — container IS the image ratio. */
          background-size: 100% 100%;
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
          -webkit-tap-highlight-color: transparent;
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
              aria-label={zone.id}
              style={{ top: zone.top, height: zone.height }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
