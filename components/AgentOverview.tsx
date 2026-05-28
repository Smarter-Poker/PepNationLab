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
  const cardZones = [
    { id: 'storefront', top: '2.5%', left: '2%', width: '46.5%', height: '17.5%',
      action: () => window.open(storefrontUrl, '_blank', 'noopener,noreferrer') },
    { id: 'researchers', top: '2.5%', left: '51.5%', width: '46.5%', height: '17.5%',
      action: () => onNavigate?.('Researchers') },
    { id: 'inventory', top: '23%', left: '2%', width: '46.5%', height: '17.5%',
      action: () => onNavigate?.('Inventory') },
    { id: 'products', top: '23%', left: '51.5%', width: '46.5%', height: '17.5%',
      action: () => onNavigate?.('Store Products') },
    { id: 'sales', top: '43.5%', left: '2%', width: '46.5%', height: '17.5%',
      action: () => onNavigate?.('Sales & Carts') },
    { id: 'orders', top: '43.5%', left: '51.5%', width: '46.5%', height: '17.5%',
      action: () => onNavigate?.('Orders') },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .dash-hero {
          position: relative;
          width: 100%;
          margin: 0 auto;
        }
        .dash-hero-img {
          width: 100%;
          height: auto;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }
        .dash-zone {
          position: absolute;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.2s ease, box-shadow 0.2s ease;
          z-index: 2;
        }
        .dash-zone:hover {
          background: rgba(0, 196, 188, 0.07);
          box-shadow: 0 0 20px rgba(0, 196, 188, 0.1);
        }
        .dash-zone:active {
          background: rgba(0, 196, 188, 0.14);
        }
        .dash-url {
          position: absolute;
          z-index: 3;
          color: #00C4BC;
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
          background: rgba(0, 196, 188, 0.06);
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

        {/* 6 card clickable zones */}
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

        {/* Dynamic storefront URL — sized with vw units so it scales with the image */}
        <span
          className="dash-url"
          style={{
            bottom: '5.5%',
            left: '5.5%',
            width: '43%',
            height: '5%',
            fontSize: 'clamp(0.45rem, 1.4vw, 0.85rem)',
          }}
        >
          {storefrontUrl}
        </span>

        {/* Invisible clickable zone over image's "Copy Link" button */}
        <button
          className="dash-btn-zone"
          onClick={copyStorefrontLink}
          aria-label={copiedStorefront ? 'Link Copied' : 'Copy Link'}
          style={{ bottom: '3.8%', right: '17.5%', width: '13%', height: '5.8%' }}
        />

        {/* Invisible clickable zone over image's "Visit Store" button */}
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dash-btn-zone"
          aria-label="Visit Store"
          style={{ bottom: '3.8%', right: '2.5%', width: '13%', height: '5.8%' }}
        />
      </div>
    </>
  );
}
