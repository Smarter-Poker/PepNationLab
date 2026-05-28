import React from 'react';
import Link from 'next/link';
import AgentAnalytics from '@/components/AgentAnalytics';

interface AgentOverviewProps {
  activeResearchersCount: number;
  activeOrdersCount: number;
  totalRevenue: number;
  storefrontUrl: string;
  copyStorefrontLink: () => void;
  copiedStorefront: boolean;
  qrCodeUrl: string;
  agentProfile: any;
  orders: any[];
}

export default function AgentOverview({
  activeResearchersCount,
  activeOrdersCount,
  totalRevenue,
  storefrontUrl,
  copyStorefrontLink,
  copiedStorefront,
  qrCodeUrl,
  agentProfile,
  orders
}: AgentOverviewProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-8)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        {/* Stats Cards */}
        <div className="grid-3">
          <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-body)', color: 'var(--teal)', marginBottom: 4 }}>
              {activeResearchersCount}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', fontWeight: 600 }}>Referred Researchers</div>
          </div>

          <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-body)', color: 'var(--teal)', marginBottom: 4 }}>
              {activeOrdersCount}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', fontWeight: 600 }}>Total Order Ledger</div>
          </div>

          <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-body)', color: 'var(--teal)', marginBottom: 4 }}>
              ${totalRevenue.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', fontWeight: 600 }}>Total Referred Revenue</div>
          </div>
        </div>

        {/* Sales Chart */}
        <AgentAnalytics agentId={agentProfile.id} orders={orders} />

        {/* URL and quick links card */}
        <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            White-Label Storefront
          </h3>
          <p style={{ color: 'var(--silver-light)', fontSize: '0.85rem', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
            Share Your Exclusive Link Directly With Your Private Clients. Any Accounts Registered via This Address Are Tied Permanently To Your Referrals.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div style={{ flexGrow: 1, background: 'var(--surface-2)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-md)', padding: '10px var(--space-4)', fontSize: '0.88rem', color: 'var(--teal)', fontFamily: 'var(--font-brand)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
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

        {/* Quick instructions */}
        <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
          <h4 style={{ color: 'var(--teal)', fontSize: '0.9rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)' }}>Agent Operations Blueprint</h4>
          <ol style={{ fontSize: '0.8rem', color: 'var(--silver-light)', paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.6 }}>
            <li>Your Referred Customers Browse And Purchase Compound Inventory Directly At Your White-Label URL.</li>
            <li>Following Checkout Submission, Clients Complete Offline Payments Via Zelle/Cash App Using Your Handles.</li>
            <li>When You Verify Bank Receipt, Transition The Order Status To Approved In The Orders Tab To Release Fulfillment.</li>
          </ol>
        </div>
      </div>

      {/* QR Code Side Card */}
      <div>
        <div className="card-metal animate-glow" style={{ textAlign: 'center', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Storefront QR Code
          </h3>
          {qrCodeUrl ? (
            <div style={{ background: 'var(--white)', padding: 12, borderRadius: 'var(--radius-lg)', display: 'inline-block', boxShadow: '0 0 20px rgba(0,196,188,0.15)', marginBottom: 'var(--space-4)' }}>
              <img src={qrCodeUrl} alt="Storefront QR Code" style={{ display: 'block', width: 200, height: 200 }} />
            </div>
          ) : (
            <div style={{ width: 224, height: 224, background: 'var(--surface-3)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <span style={{ color: 'var(--grey-400)', fontSize: '0.8rem' }}>Generating QR...</span>
            </div>
          )}
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)', lineHeight: 1.4 }}>
            Scan Or Download To Print On Marketing Literature. Automatically Routes Users To Storefront.
          </p>
          {qrCodeUrl && (
            <a href={qrCodeUrl} download={`${agentProfile.slug}-qr-code.png`} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
              Download QR Code PNG
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
