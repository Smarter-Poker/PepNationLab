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
   * Image: agent-dashboard-nav.jpg  576 × 1024 px  (9:16 portrait)
   *
   * Strategy — WIDTH-DRIVEN with 2 px gutters:
   *   .dash-hero width  = calc(100% - 4px)  →  ~386px on a 390px phone
   *   .dash-hero height = auto via aspect-ratio: 576/1024  →  ~686px
   *
   *   background-size: 100% 100%  maps image pixel-perfect onto the container
   *   (no clipping on any edge, no distortion because the container IS the
   *   image's exact aspect ratio).
   *
   *   On mobile the panel is ~686px tall. Safari's "large" viewport (chrome
   *   hidden while interacting) is ~780px — the full panel is always visible
   *   when the user is actively using the dashboard. When the browser UI bar
   *   is visible at rest (~600px), the user sees rows 1-5 + partial row 6;
   *   the click zone for row 6 is at 571px (still tappable).
   *
   *   On desktop the panel is capped at 480px wide → ~854px tall, centered on
   *   the page with dark background on the sides. All 6 rows visible.
   *
   * Click zone calibration (measured against 576×1024 source):
   *   border top: ~12px (1.2%)   border bottom: ~12px (1.2%)
   *   each row:  ~158px (15.4%)  each gap:       ~10px (1.0%)
   *
   *   Row 1 top:  1.2%    Row 2 top: 17.6%
   *   Row 3 top: 34.0%    Row 4 top: 50.5%
   *   Row 5 top: 66.9%    Row 6 top: 83.3%
   *
   *   Because the container has the exact image aspect ratio + background-size
   *   100% 100%, zone % === image pixel % — no offset math needed.
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

        /* ── Outer wrapper ────────────────────────────────────────────────── */
        .dash-hero-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;

          /* 2 px gap between global header and the image */
          padding-top: 2px;

          /* Dark fill visible on desktop beside the centered panel */
          background: #0a0a0a;
        }

        /* ── Hero panel ───────────────────────────────────────────────────── *
         *
         * Width drives height (aspect-ratio derives height from width).
         * 4 px total horizontal inset (2 px each side) — shows full brushed-
         * nickel frame with minimal dark border.
         *
         * background-size: 100% 100% → image fills the container exactly with
         * ZERO clipping because the container matches the image's own ratio.
         */
        .dash-hero {
          position: relative;
          flex-shrink: 0;

          /* 2 px gutter each side → full visible frame */
          width: calc(100% - 4px);
          max-width: 480px;           /* cap on wide desktop */

          /* Height auto-calculated by browser: width × (1024/576) */
          aspect-ratio: 576 / 1024;

          overflow: hidden;

          background-image: url('/images/agent-dashboard-nav.jpg');
          background-repeat: no-repeat;
          background-position: top left;
          background-size: 100% 100%;   /* pixel-perfect: container = image */
        }

        /* ── Click zones ─────────────────────────────────────────────────── */
        .dash-zone {
          position: absolute;
          left: 3%;
          width: 94%;
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
              aria-label={zone.id}
              style={{ top: zone.top, height: zone.height }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
