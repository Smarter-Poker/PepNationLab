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
  // The 6 clickable card zones mapped to % positions on the background image
  // Image is 1024x867. Cards grid occupies ~top 63%, bottom card ~bottom 37%
  const cardZones = [
    {
      id: 'storefront',
      top: '1.5%', left: '1.5%', width: '47%', height: '18.5%',
      action: () => window.open(storefrontUrl, '_blank', 'noopener,noreferrer'),
    },
    {
      id: 'researchers',
      top: '1.5%', left: '51.5%', width: '47%', height: '18.5%',
      action: () => onNavigate?.('Researchers'),
    },
    {
      id: 'inventory',
      top: '22%', left: '1.5%', width: '47%', height: '18.5%',
      action: () => onNavigate?.('Inventory'),
    },
    {
      id: 'products',
      top: '22%', left: '51.5%', width: '47%', height: '18.5%',
      action: () => onNavigate?.('Store Products'),
    },
    {
      id: 'sales',
      top: '42.5%', left: '1.5%', width: '47%', height: '18.5%',
      action: () => onNavigate?.('Sales & Carts'),
    },
    {
      id: 'orders',
      top: '42.5%', left: '51.5%', width: '47%', height: '18.5%',
      action: () => onNavigate?.('Orders'),
    },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .dashboard-hero-container {
          position: relative;
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
        }
        .dashboard-hero-img {
          width: 100%;
          height: auto;
          display: block;
          border-radius: var(--radius-lg, 12px);
          user-select: none;
          -webkit-user-drag: none;
        }
        .dashboard-card-zone {
          position: absolute;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.2s ease, box-shadow 0.2s ease;
          z-index: 2;
        }
        .dashboard-card-zone:hover {
          background: rgba(0, 196, 188, 0.08);
          box-shadow: 0 0 30px rgba(0, 196, 188, 0.15), inset 0 0 20px rgba(0, 196, 188, 0.05);
        }
        .dashboard-card-zone:active {
          background: rgba(0, 196, 188, 0.15);
        }
        .dashboard-bottom-overlay {
          position: absolute;
          z-index: 3;
        }
        .dashboard-url-display {
          font-family: var(--font-brand, monospace);
          font-size: 0.82rem;
          color: var(--teal, #00C4BC);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
        }
        .dashboard-bottom-btn {
          cursor: pointer;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          font-family: var(--font-brand, sans-serif);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .dashboard-bottom-btn:hover {
          transform: scale(1.05);
        }
        .dashboard-bottom-btn:active {
          transform: scale(0.97);
        }
        .dashboard-btn-copy {
          background: rgba(255,255,255,0.08);
          color: var(--silver-light, #C8D0D8);
          border: 1px solid rgba(255,255,255,0.15);
        }
        .dashboard-btn-copy:hover {
          background: rgba(255,255,255,0.14);
        }
        .dashboard-btn-visit {
          background: var(--teal, #00C4BC);
          color: var(--black, #050A0F);
          box-shadow: 0 0 16px rgba(0, 196, 188, 0.4);
        }
        .dashboard-btn-visit:hover {
          box-shadow: 0 0 28px rgba(0, 196, 188, 0.6);
        }
        /* Mobile responsive */
        @media (max-width: 600px) {
          .dashboard-url-display {
            font-size: 0.68rem;
          }
          .dashboard-bottom-btn {
            font-size: 0.68rem;
            padding: 6px 10px;
          }
        }
      `}} />

      <div className="dashboard-hero-container">
        {/* Background Image — the exact design from the user */}
        <img
          src="/images/agent-dashboard-nav.jpg"
          alt="Agent Dashboard Navigation"
          className="dashboard-hero-img"
          draggable={false}
        />

        {/* Clickable overlay zones for the 6 cards */}
        {cardZones.map((zone) => (
          <div
            key={zone.id}
            className="dashboard-card-zone"
            onClick={zone.action}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') zone.action(); }}
            aria-label={zone.id.replace(/-/g, ' ')}
            style={{
              top: zone.top,
              left: zone.left,
              width: zone.width,
              height: zone.height,
            }}
          />
        ))}

        {/* Bottom card overlay — Dynamic URL + buttons */}
        {/* URL text positioned over the dark input area in the image */}
        <div
          className="dashboard-bottom-overlay"
          style={{
            bottom: '5.5%',
            left: '4%',
            width: '52%',
            height: '5.5%',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '1%',
          }}
        >
          <span className="dashboard-url-display">{storefrontUrl}</span>
        </div>

        {/* Copy Link button positioned over the "Copy Link" area */}
        <button
          className="dashboard-bottom-btn dashboard-btn-copy"
          onClick={copyStorefrontLink}
          style={{
            position: 'absolute',
            bottom: '5%',
            right: '20%',
            zIndex: 4,
          }}
        >
          {copiedStorefront ? 'Copied!' : 'Copy Link'}
        </button>

        {/* Visit Store button positioned over the "Visit Store" area */}
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dashboard-bottom-btn dashboard-btn-visit"
          style={{
            position: 'absolute',
            bottom: '5%',
            right: '3%',
            zIndex: 4,
          }}
        >
          Visit Store
        </a>
      </div>
    </>
  );
}
