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
    { id: 'storefront', top: '2%', left: '1.5%', width: '47%', height: '18%',
      action: () => window.open(storefrontUrl, '_blank', 'noopener,noreferrer') },
    { id: 'researchers', top: '2%', left: '51.5%', width: '47%', height: '18%',
      action: () => onNavigate?.('Researchers') },
    { id: 'inventory', top: '23%', left: '1.5%', width: '47%', height: '18%',
      action: () => onNavigate?.('Inventory') },
    { id: 'products', top: '23%', left: '51.5%', width: '47%', height: '18%',
      action: () => onNavigate?.('Store Products') },
    { id: 'sales', top: '44%', left: '1.5%', width: '47%', height: '18%',
      action: () => onNavigate?.('Sales & Carts') },
    { id: 'orders', top: '44%', left: '51.5%', width: '47%', height: '18%',
      action: () => onNavigate?.('Orders') },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .dash-hero {
          position: relative;
          width: 100%;
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
          transition: background 0.15s ease;
          z-index: 2;
        }
        .dash-zone:hover {
          background: rgba(0, 196, 188, 0.06);
        }
        .dash-zone:active {
          background: rgba(0, 196, 188, 0.12);
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
          background: rgba(255,255,255,0.04);
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

        {/* Dynamic storefront URL — inside the dark input frame */}
        <span
          className="dash-url"
          style={{
            bottom: '6%',
            left: '6%',
            width: '50%',
            height: '5%',
            fontSize: 'clamp(0.65rem, 2vw, 1.05rem)',
          }}
        >
          {storefrontUrl}
        </span>

        {/* Invisible clickable zone over "Copy Link" button */}
        <button
          className="dash-btn-zone"
          onClick={copyStorefrontLink}
          aria-label={copiedStorefront ? 'Link Copied' : 'Copy Link'}
          style={{ bottom: '7%', right: '20%', width: '14%', height: '5.5%' }}
        />

        {/* Invisible clickable zone over "Visit Store" button */}
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dash-btn-zone"
          aria-label="Visit Store"
          style={{ bottom: '7%', right: '5%', width: '13%', height: '5.5%' }}
        />
      </div>
    </>
  );
}
