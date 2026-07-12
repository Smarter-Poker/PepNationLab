'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface TopResearcher {
  name: string;
  order_count: number;
  total_spent: number;
}

interface ReferralData {
  referral_url: string | null;
  referral_code?: string | null;
  total_referred: number;
  total_orders: number;
  total_revenue: number;
  top_researchers: TopResearcher[];
}

interface AgentReferralsClientProps {
  agentSlug: string | null;
}

export default function AgentReferralsClient({ agentSlug }: AgentReferralsClientProps) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/agent/referrals');
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed To Load Referral Data');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'An Unexpected Error Occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopy = () => {
    if (!data?.referral_url) return;
    navigator.clipboard.writeText(data.referral_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const referralUrl = data?.referral_url ?? (agentSlug ? `https://pepnationlab.com/signup?ref=${agentSlug}` : null);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      <Navbar title="My Referrals" />

      <div
        className="container"
        style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}
      >
        {/* Back Link */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Link
            href="/dashboard/agent"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--teal)',
              fontSize: '0.88rem',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back To Dashboard
          </Link>
        </div>

        {/* Page Header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              color: 'var(--white)',
              margin: 0,
              marginBottom: 6,
              letterSpacing: '-0.02em',
            }}
          >
            My Referrals
          </h1>
          <p style={{ color: 'var(--silver-light)', fontSize: '0.9rem', margin: 0 }}>
            Share Your Unique Invite Link To Recruit Researchers To Your Storefront.
          </p>
        </div>

        {error && (
          <div
            style={{
              borderLeft: '3px solid var(--red)',
              background: 'var(--red-bg)',
              padding: 'var(--space-4)',
              borderRadius: '0 var(--radius-md) var(--radius-md) 0',
              marginBottom: 'var(--space-6)',
            }}
          >
            <p style={{ color: 'var(--red)', fontSize: '0.85rem', margin: 0 }}>{error}</p>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--silver)', padding: 'var(--space-8) 0', textAlign: 'center' }}>
            Loading Referral Data...
          </div>
        ) : (
          <>
            {/* Referral Link Card */}
            <div
              className="card"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid rgba(0,196,188,0.18)',
                borderRadius: 16,
                padding: 'var(--space-6)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <h2
                style={{
                  fontWeight: 700,
                  color: 'var(--teal)',
                  margin: 0,
                  marginBottom: 'var(--space-4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: '0.8rem',
                }}
              >
                Your Referral Invite Link
              </h2>

              {referralUrl ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                      marginBottom: 'var(--space-5)',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'var(--surface-3)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        padding: '11px 14px',
                        fontFamily: 'monospace',
                        fontSize: '0.88rem',
                        color: 'var(--ivory)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {referralUrl}
                    </div>
                    <button
                      className="btn-primary"
                      onClick={handleCopy}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 18px',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        background: copied ? 'var(--teal-dark, #009c96)' : 'var(--teal)',
                        color: '#000',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.2s',
                      }}
                    >
                      {copied ? (
                        <>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Copied
                        </>
                      ) : (
                        <>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>

                  {/* QR Code */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ color: 'var(--silver)', fontSize: '0.8rem', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        QR Code
                      </p>
                      <img
                        src={`/api/agent/referral-qr?ref=${encodeURIComponent(data?.referral_code ?? agentSlug ?? '')}`}
                        alt="Referral QR Code"
                        width={140}
                        height={140}
                        style={{
                          display: 'block',
                          background: '#fff',
                          borderRadius: 8,
                          padding: 6,
                        }}
                      />
                    </div>
                    <div style={{ paddingTop: 28 }}>
                      <p style={{ color: 'var(--silver-light)', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
                        Share This QR Code In Person Or Digitally. Researchers Who Sign Up Via Your Link Or QR Code Are Automatically Added To Your Downline.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--silver)', fontSize: '0.9rem', margin: 0 }}>
                  You Must Complete Your Storefront Setup Before A Referral Link Is Generated.
                </p>
              )}
            </div>

            {/* Stats Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)',
              }}
            >
              {[
                {
                  label: 'Researchers Referred',
                  value: (data?.total_referred ?? 0).toLocaleString(),
                },
                {
                  label: 'Orders Placed',
                  value: (data?.total_orders ?? 0).toLocaleString(),
                },
                {
                  label: 'Revenue Generated',
                  value: `$${(data?.total_revenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14,
                    padding: 'var(--space-5)',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--silver)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      margin: '0 0 8px',
                    }}
                  >
                    {stat.label}
                  </p>
                  <p
                    style={{
                      fontSize: '1.8rem',
                      fontWeight: 800,
                      color: 'var(--white)',
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Top Researchers Table */}
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: 'var(--space-5) var(--space-6)',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <h2
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--teal)',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Top Researchers By Order Value
                </h2>
              </div>

              {!data?.top_researchers || data.top_researchers.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', color: 'var(--silver)', fontSize: '0.9rem', textAlign: 'center' }}>
                  No Orders From Referred Researchers Yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.88rem',
                    }}
                  >
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {['Researcher', 'Orders', 'Total Spent'].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '12px 20px',
                              textAlign: h === 'Researcher' ? 'left' : 'right',
                              color: 'var(--silver)',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_researchers.map((r, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '13px 20px', color: 'var(--ivory)', fontWeight: 500 }}>
                            {r.name}
                          </td>
                          <td style={{ padding: '13px 20px', color: 'var(--silver-light)', textAlign: 'right' }}>
                            {r.order_count}
                          </td>
                          <td
                            style={{
                              padding: '13px 20px',
                              color: 'var(--teal)',
                              textAlign: 'right',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            ${r.total_spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
