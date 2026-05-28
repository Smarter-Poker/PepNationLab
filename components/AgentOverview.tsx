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
  activeResearchersCount,
  activeOrdersCount,
  totalRevenue,
  storefrontUrl,
  copyStorefrontLink,
  copiedStorefront,
  agentProfile,
  orders,
  onNavigate
}: AgentOverviewProps) {

  const navCards = [
    {
      id: 'storefront',
      title: 'Visit Storefront',
      subtitle: 'Open your white-label store in a new tab',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      ),
      action: () => window.open(storefrontUrl, '_blank', 'noopener,noreferrer'),
    },
    {
      id: 'researchers',
      title: 'Create Researcher Accounts',
      subtitle: 'Add & manage referred researcher profiles',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      ),
      action: () => onNavigate?.('Researchers'),
    },
    {
      id: 'inventory',
      title: 'Inventory Management',
      subtitle: 'Control compound stock levels & pricing',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
      action: () => onNavigate?.('Inventory'),
    },
    {
      id: 'products',
      title: 'My Products',
      subtitle: 'Browse & configure your storefront catalog',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      action: () => onNavigate?.('Store Products'),
    },
    {
      id: 'sales',
      title: 'Sales & Charts, Accounting',
      subtitle: 'Revenue analytics, live carts & ledger data',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      ),
      action: () => onNavigate?.('Sales & Carts'),
    },
    {
      id: 'orders',
      title: 'Orders & Fulfillment',
      subtitle: 'Process, approve & ship researcher orders',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
      action: () => onNavigate?.('Orders'),
    },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .overview-nav-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-5);
        }
        @media (max-width: 768px) {
          .overview-nav-grid {
            grid-template-columns: 1fr;
          }
        }
        .overview-nav-card {
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .overview-nav-card:hover {
          transform: scale(1.025);
          border-color: rgba(0,196,188,0.35);
          box-shadow: 0 0 24px rgba(0,196,188,0.12), 0 4px 20px rgba(0,0,0,0.3);
        }
        .overview-nav-card:active {
          transform: scale(0.99);
        }
      `}} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        {/* 6 Navigation Cards */}
        <div className="overview-nav-grid">
          {navCards.map((card) => (
            <div
              key={card.id}
              className="card-metal overview-nav-card"
              onClick={card.action}
              style={{
                padding: 'var(--space-6)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-5)',
              }}
            >
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                {card.icon}
              </div>
              <div>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--white)',
                  fontFamily: 'var(--font-brand)',
                  letterSpacing: '0.03em',
                  marginBottom: 4,
                }}>
                  {card.title}
                </div>
                <div style={{
                  fontSize: '0.78rem',
                  color: 'var(--grey-400)',
                  lineHeight: 1.45,
                }}>
                  {card.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Share Your Storefront — Footer Card */}
        <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{
            fontSize: '1rem',
            color: 'var(--white)',
            marginBottom: 'var(--space-4)',
            fontFamily: 'var(--font-brand)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Share Your Storefront
          </h3>
          <p style={{
            color: 'var(--silver-light)',
            fontSize: '0.85rem',
            marginBottom: 'var(--space-4)',
            lineHeight: 1.5,
          }}>
            Share Your Exclusive Link Directly With Your Private Clients. Any Accounts Registered Via This Address Are Tied Permanently To Your Referrals.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div style={{
              flexGrow: 1,
              background: 'var(--surface-2)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              padding: '10px var(--space-4)',
              fontSize: '0.88rem',
              color: 'var(--teal)',
              fontFamily: 'var(--font-brand)',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
            }}>
              {storefrontUrl}
            </div>
            <button onClick={copyStorefrontLink} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
              {copiedStorefront ? 'Link Copied' : 'Copy Link'}
            </button>
            <a href={storefrontUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
              Visit Store
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
