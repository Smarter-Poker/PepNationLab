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
  // 6 nav card clickable zones (percentage positions on the 1024x866 image)
  const cardZones = [
    { id: 'storefront', top: '1%', left: '1%', width: '47%', height: '18%',
      action: () => window.open(storefrontUrl, '_blank', 'noopener,noreferrer') },
    { id: 'researchers', top: '1%', left: '52%', width: '47%', height: '18%',
      action: () => onNavigate?.('Researchers') },
    { id: 'inventory', top: '22%', left: '1%', width: '47%', height: '18%',
      action: () => onNavigate?.('Inventory') },
    { id: 'products', top: '22%', left: '52%', width: '47%', height: '18%',
      action: () => onNavigate?.('Store Products') },
    { id: 'sales', top: '43%', left: '1%', width: '47%', height: '18%',
      action: () => onNavigate?.('Sales & Carts') },
    { id: 'orders', top: '43%', left: '52%', width: '47%', height: '18%',
      action: () => onNavigate?.('Orders') },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .dash-hero {
          position: relative;
          width: 100%;
          max-width: 900px;
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
          border-radius: 8px;
          transition: background 0.2s ease, box-shadow 0.2s ease;
          z-index: 2;
        }
        .dash-zone:hover {
          background: rgba(0, 196, 188, 0.07);
          box-shadow: 0 0 24px rgba(0, 196, 188, 0.12);
        }
        .dash-zone:active {
          background: rgba(0, 196, 188, 0.14);
        }
        /* URL text inside the dark input area of the bottom card */
        .dash-url {
          position: absolute;
          z-index: 3;
          font-family: var(--font-brand, monospace);
          font-size: 0.75rem;
          color: var(--teal, #00C4BC);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        /* Invisible clickable zone over the image's Copy Link button */
        .dash-btn-zone {
          position: absolute;
          cursor: pointer;
          z-index: 3;
          background: transparent;
          border: none;
          padding: 0;
        }
        .dash-btn-zone:hover {
          background: rgba(255,255,255,0.04);
          border-radius: 4px;
        }
        @media (max-width: 600px) {
          .dash-url {
            font-size: 0.6rem;
          }
        }
        @media (max-width: 400px) {
          .dash-url {
            font-size: 0.5rem;
          }
        }
      `}} />

      <div className="dash-hero">
        <img
          src="/images/agent-dashboard-nav.jpg"
          alt="Agent Dashboard Navigation"
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

        {/* Dynamic storefront URL text — positioned inside the dark input box */}
        <span
          className="dash-url"
          style={{
            bottom: '5.8%',
            left: '5%',
            width: '46%',
            height: '5%',
          }}
        >
          {storefrontUrl}
        </span>

        {/* Invisible clickable zone over "Copy Link" button in the image */}
        <button
          className="dash-btn-zone"
          onClick={copyStorefrontLink}
          aria-label={copiedStorefront ? 'Link Copied' : 'Copy Link'}
          style={{
            bottom: '4.2%',
            right: '17%',
            width: '14%',
            height: '6%',
          }}
        />

        {/* Invisible clickable zone over "Visit Store" button in the image */}
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dash-btn-zone"
          aria-label="Visit Store"
          style={{
            bottom: '4.2%',
            right: '1.5%',
            width: '14%',
            height: '6%',
          }}
        />
      </div>
    </>
  );
}
