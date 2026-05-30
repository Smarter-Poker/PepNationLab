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
  copyStorefrontLink,
  copiedStorefront,
  onNavigate
}: AgentOverviewProps) {
  /* Stacked vertical layout — 6 full-width rows + bottom share section
     Image is 1022 x 769. Rows are evenly spaced in the top ~75% of the image. */
  const cardZones = [
    { id: 'storefront', top: '1%', left: '2%', width: '96%', height: '11%',
      action: () => window.open(storefrontUrl, '_blank', 'noopener,noreferrer') },
    { id: 'researchers', top: '14%', left: '2%', width: '96%', height: '11%',
      action: () => onNavigate?.('Researchers') },
    { id: 'inventory', top: '27%', left: '2%', width: '96%', height: '11%',
      action: () => onNavigate?.('Inventory') },
    { id: 'products', top: '40%', left: '2%', width: '96%', height: '11%',
      action: () => onNavigate?.('Store Products') },
    { id: 'sales', top: '53%', left: '2%', width: '96%', height: '11%',
      action: () => onNavigate?.('Sales & Carts') },
    { id: 'orders', top: '66%', left: '2%', width: '96%', height: '11%',
      action: () => onNavigate?.('Orders') },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .dash-hero {
          position: relative;
          width: 100%;
          /* Fill from just below the top nav all the way to the bottom of the viewport.
             --nav-h is 64px (the height of the .nav bar). Fall back to 64px. */
          height: calc(100dvh - 64px);
          min-height: 400px;
          overflow: hidden;
        }
        .dash-hero-img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;           /* fills the box, crops if needed */
          object-position: top center; /* keep menu items visible at top */
          user-select: none;
          -webkit-user-drag: none;
        }
        .dash-zone {
          position: absolute;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.15s ease;
          z-index: 2;
        }
        .dash-zone:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .dash-zone:active {
          background: rgba(255, 255, 255, 0.08);
        }
        .dash-url {
          position: absolute;
          z-index: 3;
          color: #C0B8A8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
          display: flex;
          align-items: center;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .dash-btn-zone {
          position: absolute;
          cursor: pointer;
          z-index: 3;
          background: transparent;
          border: none;
          padding: 0;
          display: block;
        }
        .dash-btn-zone:hover {
          background: rgba(255,255,255,0.06);
          border-radius: 4px;
        }
      `}} />

      <div className="dash-hero">
        <img
          src="/images/agent-dashboard-nav.jpg"
          alt="Agent Dashboard"
          className="dash-hero-img"
          draggable={false}
        />

        {/* 6 stacked card clickable zones */}
        {cardZones.map((zone) => (
          <div
            key={zone.id}
            className="dash-zone"
            onClick={zone.action}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') zone.action(); }}
            aria-label={zone.id}
            style={{ top: zone.top, left: zone.left, width: zone.width, height: zone.height }}
          />
        ))}

        {/* Dynamic storefront URL — inside the dark input frame at bottom */}
        <span
          className="dash-url"
          style={{
            bottom: '6%',
            left: '7%',
            width: '50%',
            height: '5%',
            fontSize: 'clamp(0.85rem, 2.4vw, 1.4rem)',
          }}
        >
          {storefrontUrl}
        </span>

        {/* Invisible clickable zone over "Copy Link" button */}
        <button
          className="dash-btn-zone"
          onClick={copyStorefrontLink}
          aria-label={copiedStorefront ? 'Link Copied' : 'Copy Link'}
          style={{ bottom: '5.5%', right: '22%', width: '14%', height: '5.5%' }}
        />

        {/* Invisible clickable zone over "Visit Store" button */}
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dash-btn-zone"
          aria-label="Visit Store"
          style={{ bottom: '5.5%', right: '7%', width: '12%', height: '5.5%' }}
        />
      </div>
    </>
  );
}
