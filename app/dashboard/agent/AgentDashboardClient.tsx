'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import QRCode from 'qrcode';
import Link from 'next/link';
import AgentCoupons from '@/components/AgentCoupons';
import AgentMessages from '@/components/AgentMessages';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  tier: string | null;
}

interface AgentProfile {
  id: string;
  slug: string;
  display_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  bio: string | null;
  qr_code_url: string | null;
  payment_handles: Record<string, any> | null;
}

interface Researcher {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  created_at: string;
}

interface Order {
  id: string;
  buyer_id: string;
  status: string;
  fulfillment_method: string;
  payment_method: string;
  shipping_address: any;
  shipping_cost: number;
  subtotal: number;
  total: number;
  created_at: string;
  buyer_name: string;
  buyer_email: string;
}

interface AgentDashboardClientProps {
  userProfile: Profile;
  initialAgentProfile: AgentProfile | null;
  initialResearchers: Researcher[];
  initialOrders: Order[];
}

export default function AgentDashboardClient({
  userProfile,
  initialAgentProfile,
  initialResearchers,
  initialOrders
}: AgentDashboardClientProps) {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'Overview' | 'Researchers' | 'Orders' | 'Coupons' | 'Messages' | 'Storefront Config'>('Overview');
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(initialAgentProfile);
  const [researchers] = useState<Researcher[]>(initialResearchers);
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // QR Code State
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // Storefront Config Form State
  const [displayName, setDisplayName] = useState(agentProfile?.display_name ?? '');
  const [slug, setSlug] = useState(agentProfile?.slug ?? '');
  const [tagline, setTagline] = useState(agentProfile?.tagline ?? '');
  const [bio, setBio] = useState(agentProfile?.bio ?? '');
  const [primaryColor, setPrimaryColor] = useState(agentProfile?.primary_color ?? '#00C4BC');
  const [zelleHandle, setZelleHandle] = useState(agentProfile?.payment_handles?.zelle ?? '');
  const [cashappHandle, setCashappHandle] = useState(agentProfile?.payment_handles?.cashapp ?? '');
  const [venmoHandle, setVenmoHandle] = useState(agentProfile?.payment_handles?.venmo ?? '');
  const [applePayHandle, setApplePayHandle] = useState(agentProfile?.payment_handles?.apple_pay ?? '');

  // Setup Form State (If no profile exists yet)
  const [setupDisplayName, setSetupDisplayName] = useState('');
  const [setupSlug, setSetupSlug] = useState('');
  const [setupTagline, setSetupTagline] = useState('');

  // Status and Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedStorefront, setCopiedStorefront] = useState(false);

  // Create Researcher Modal State
  const [showCreateResearcher, setShowCreateResearcher] = useState(false);
  const [crFullName, setCrFullName] = useState('');
  const [crUsername, setCrUsername] = useState('');
  const [crPassword, setCrPassword] = useState('');
  const [crLoading, setCrLoading] = useState(false);
  const [crError, setCrError] = useState('');
  const [crSuccess, setCrSuccess] = useState('');
  const [researcherList, setResearcherList] = useState<Researcher[]>(initialResearchers);

  async function handleCreateResearcher(e: React.FormEvent) {
    e.preventDefault();
    setCrLoading(true);
    setCrError('');
    setCrSuccess('');
    try {
      const res = await fetch('/api/agent/create-researcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: crFullName, username: crUsername, password: crPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCrError(json.error || 'Failed To Create Researcher Account');
      } else {
        setCrSuccess(`Researcher Account Created — Username: ${json.username}`);
        setResearcherList(prev => [...prev, {
          id: json.userId,
          email: `${json.username}@pepnationlab.com`,
          username: json.username,
          full_name: json.full_name,
          created_at: new Date().toISOString(),
        }]);
        setCrFullName('');
        setCrUsername('');
        setCrPassword('');
        setTimeout(() => { setShowCreateResearcher(false); setCrSuccess(''); }, 2000);
      }
    } catch (err: any) {
      setCrError(err.message || 'Network Error');
    } finally {
      setCrLoading(false);
    }
  }

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const storefrontUrl = agentProfile ? `${originUrl}/${agentProfile.slug}` : '';

  // Generate QR Code once the storefront URL is loaded
  useEffect(() => {
    if (storefrontUrl) {
      QRCode.toDataURL(
        storefrontUrl,
        {
          width: 250,
          margin: 2,
          color: {
            dark: '#050A0F',
            light: '#FFFFFF',
          },
        },
        (err, url) => {
          if (!err && url) {
            setQrCodeUrl(url);
          }
        }
      );
    }
  }, [storefrontUrl]);

  // Handle Initial Storefront Setup Creation
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate slug
    const cleanSlug = setupSlug.trim().toLowerCase();
    if (!/^[a-z0-9\-]+$/.test(cleanSlug)) {
      setError('Storefront URL Slug Must Only Contain Lowercase Letters, Numbers, And Hyphens.');
      return;
    }
    if (cleanSlug.length < 2 || cleanSlug.length > 50) {
      setError('Storefront URL Slug Length Must Be Between 2 And 50 Characters.');
      return;
    }
    if (!setupDisplayName.trim()) {
      setError('Storefront Display Name Is Required.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('agent_profiles')
        .insert({
          id: userProfile.id,
          slug: cleanSlug,
          display_name: setupDisplayName.trim(),
          tagline: setupTagline.trim() || null,
          payment_handles: {
            zelle: 'payments@pepnationlab.com',
            cashapp: '$PepNationLab',
            venmo: '@PepNationLab',
            apple_pay: 'payments@pepnationlab.com'
          }
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message ?? 'Failed To Create Storefront Profile.');
      }

      setAgentProfile(data);
      setDisplayName(data.display_name);
      setSlug(data.slug);
      setTagline(data.tagline ?? '');
      setSuccess('Your Storefront White-Label Profile Has Been Successfully Activated!');
    } catch (err: any) {
      setError(err.message ?? 'An Error Occurred During Setup.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Updates to Storefront Configurations
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate slug
    const cleanSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9\-]+$/.test(cleanSlug)) {
      setError('Storefront URL Slug Must Only Contain Lowercase Letters, Numbers, And Hyphens.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: updateError } = await supabase
        .from('agent_profiles')
        .update({
          slug: cleanSlug,
          display_name: displayName.trim(),
          tagline: tagline.trim() || null,
          bio: bio.trim() || null,
          primary_color: primaryColor,
          payment_handles: {
            zelle: zelleHandle.trim() || null,
            cashapp: cashappHandle.trim() || null,
            venmo: venmoHandle.trim() || null,
            apple_pay: applePayHandle.trim() || null
          }
        })
        .eq('id', userProfile.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message ?? 'Failed To Save Configurations.');
      }

      setAgentProfile(data);
      setSuccess('Storefront Configuration Settings Successfully Saved!');
    } catch (err: any) {
      setError(err.message ?? 'An Error Occurred Saving Configurations.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Order Status Transition / Approvals
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setError(null);
    setSuccess(null);

    try {
      const updates: Record<string, any> = { status: newStatus };
      if (newStatus.startsWith('approved_')) {
        updates.agent_approved_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (updateError) {
        throw new Error(updateError.message ?? 'Failed To Transition Order.');
      }

      // Update local state
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
      setSuccess(`Order Status Shifted To ${newStatus.replace(/_/g, ' ').toUpperCase()}`);
    } catch (err: any) {
      setError(err.message ?? 'An Error Occurred Updating Order Status.');
    }
  };

  const copyStorefrontLink = () => {
    navigator.clipboard.writeText(storefrontUrl);
    setCopiedStorefront(true);
    setTimeout(() => setCopiedStorefront(false), 2000);
  };

  // Compute stats
  const activeResearchersCount = researchers.length;
  const activeOrdersCount = orders.length;
  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((acc, o) => acc + Number(o.total), 0);

  // If agent has no profile setup yet, show launch storefront screen
  if (!agentProfile) {
    return (
      <div className="container-sm section" style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="card-metal" style={{ width: '100%', maxWidth: 550, padding: 'var(--space-8)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--teal)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block', margin: '0 auto var(--space-3)' }}
            >
              <path d="M4.5 16.5c-1.5 1.26-2 3.42-2 3.42s2.16-.5 3.42-2c1.24-1.47 3.58-2.9 3.58-2.9l-2.1-2.1s-1.43 2.34-2.9 3.58z" />
              <path d="M12 15l9 3-3-9-6-6-3 3 3 9z" />
              <path d="M9 15l2-2" />
              <path d="M14 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0z" />
            </svg>
            <h1 style={{ fontSize: '1.8rem', color: 'var(--teal)', marginBottom: 'var(--space-2)' }}>Launch Storefront</h1>
            <p style={{ color: 'var(--silver-light)', fontSize: '0.9rem' }}>
              Create Your Exclusive White-Label Web Storefront To Refer Researchers And Track Dynamic Orders.
            </p>
          </div>

          {error && (
            <div style={{ borderLeft: '3px solid var(--red)', background: 'var(--red-bg)', padding: 'var(--space-4)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 'var(--space-6)' }}>
              <p style={{ color: 'var(--red)', fontSize: '0.82rem', margin: 0 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleCreateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Storefront Display Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="E.g. Bio-Science Labs"
                value={setupDisplayName}
                onChange={(e) => setSetupDisplayName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Storefront URL Slug</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', paddingLeft: 'var(--space-3)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)', userSelect: 'none' }}>pepnationlab.com/</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="E.g. bioscience"
                  value={setupSlug}
                  onChange={(e) => setSetupSlug(e.target.value)}
                  style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
                  required
                />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>
                Lowercase Letters, Numbers, And Hyphens Only. No Spaces.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Storefront Tagline</label>
              <input
                type="text"
                className="form-input"
                placeholder="E.g. Ultra-Pure Peptides For Lab Experimentation"
                value={setupTagline}
                onChange={(e) => setSetupTagline(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-4)', width: '100%' }} disabled={loading}>
              {loading ? 'Activating Profile...' : 'Activate Storefront Catalog'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      {/* Top Navbar */}
      <nav style={{
        height: 64,
        background: 'var(--black-2)',
        borderBottom: 'var(--border-silver)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Link href="/dashboard" style={{ color: 'var(--grey-400)', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back To Hub
          </Link>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontFamily: 'var(--font-brand)', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--teal)' }}>
            AGENT STOREFRONT PANEL
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{agentProfile.display_name}</span>
          <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>
            Tier {userProfile.tier ? userProfile.tier.replace('tier_', '') : '3'}
          </span>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}>
        {/* Status Alerts */}
        {error && (
          <div style={{ borderLeft: '3px solid var(--red)', background: 'var(--red-bg)', padding: 'var(--space-4)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 'var(--space-6)' }}>
            <p style={{ color: 'var(--red)', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{ borderLeft: '3px solid var(--teal)', background: 'rgba(0,196,188,0.06)', padding: 'var(--space-4)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 'var(--space-6)' }}>
            <p style={{ color: 'var(--teal)', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>{success}</p>
          </div>
        )}

        {/* Tab Controls */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {(['Overview', 'Researchers', 'Orders', 'Coupons', 'Messages', 'Storefront Config'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setError(null); setSuccess(null); }}
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--space-3) var(--space-4)',
                fontFamily: 'var(--font-brand)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: activeTab === tab ? 'var(--teal)' : 'var(--grey-400)',
                borderBottom: activeTab === tab ? '2px solid var(--teal)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TAB 1: Overview */}
        {activeTab === 'Overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-8)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              {/* Stats Cards */}
              <div className="grid-3">
                <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color: 'var(--teal)', marginBottom: 4 }}>
                    {activeResearchersCount}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', fontWeight: 600 }}>Referred Researchers</div>
                </div>

                <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color: 'var(--teal)', marginBottom: 4 }}>
                    {activeOrdersCount}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', fontWeight: 600 }}>Total Order Ledger</div>
                </div>

                <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color: 'var(--teal)', marginBottom: 4 }}>
                    ${totalRevenue.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', fontWeight: 600 }}>Total Referred Revenue</div>
                </div>
              </div>

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
              <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
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
        )}

        {/* TAB 2: Referred Researchers */}
        {activeTab === 'Researchers' && (
          <div>
            {/* Create Researcher Modal */}
            {showCreateResearcher && (
              <div onClick={() => setShowCreateResearcher(false)} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, padding: 'var(--space-6)', backdropFilter: 'blur(4px)',
              }}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: 'var(--grey-900)', border: '1px solid rgba(0,196,188,0.25)',
                  borderRadius: 16, padding: 'var(--space-7)', maxWidth: 420, width: '100%',
                  boxShadow: '0 0 60px rgba(0,196,188,0.1)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: 4 }}>Create Researcher Account</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>Account Will Be Linked To Your Agency</p>
                    </div>
                    <button onClick={() => setShowCreateResearcher(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--grey-400)', cursor: 'pointer' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>

                  {crError && <div style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8, padding: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: '0.82rem', color: 'var(--red)' }}>{crError}</div>}
                  {crSuccess && <div style={{ background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', borderRadius: 8, padding: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: '0.82rem', color: 'var(--teal)' }}>{crSuccess}</div>}

                  <form onSubmit={handleCreateResearcher} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input type="text" className="form-input" placeholder="E.g. Dr. Jane Smith"
                        value={crFullName} onChange={e => setCrFullName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Username</label>
                      <input type="text" className="form-input" placeholder="E.g. jsmith"
                        value={crUsername} onChange={e => setCrUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        required autoCapitalize="none" spellCheck={false} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Temporary Password</label>
                      <input type="text" className="form-input" placeholder="Min 8 Characters"
                        value={crPassword} onChange={e => setCrPassword(e.target.value)} required />
                      <p style={{ fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: 4 }}>You Set This — Tell Them Directly. No Automatic Emails.</p>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={crLoading}
                      style={{ width: '100%', justifyContent: 'center', opacity: crLoading ? 0.7 : 1 }}>
                      {crLoading ? 'Creating Account...' : 'Create Researcher Account'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>My Researchers</h3>
                  <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', marginTop: 4 }}>All Researcher Accounts You Have Created</p>
                </div>
                <button onClick={() => { setShowCreateResearcher(true); setCrError(''); setCrSuccess(''); }}
                  className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                  + Create Researcher Account
                </button>
              </div>

              {researcherList.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--grey-400)' }}>
                        <th style={{ padding: 'var(--space-3) 0', fontWeight: 600 }}>Full Name</th>
                        <th style={{ padding: 'var(--space-3) 0', fontWeight: 600 }}>Username</th>
                        <th style={{ padding: 'var(--space-3) 0', fontWeight: 600 }}>Created</th>
                        <th style={{ padding: 'var(--space-3) 0', fontWeight: 600 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {researcherList.map((res) => (
                        <tr key={res.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--silver-light)' }}>
                          <td style={{ padding: 'var(--space-3) 0', fontWeight: 500 }}>{res.full_name || 'Anonymous Researcher'}</td>
                          <td style={{ padding: 'var(--space-3) 0', fontFamily: 'var(--font-brand)', fontSize: '0.78rem', color: 'var(--teal)' }}>
                            @{res.username ?? res.email.split('@')[0]}
                          </td>
                          <td style={{ padding: 'var(--space-3) 0' }}>{new Date(res.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: 'var(--space-3) 0' }}>
                            <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>Active</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', opacity: 0.6 }}>
                  <h4 style={{ color: 'var(--silver)' }}>No Researchers Yet</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>Click "Create Researcher Account" To Add Your First Researcher.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Referred Orders */}
        {activeTab === 'Orders' && (
          <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Referred Order Ledger
            </h3>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
              Manage Orders Registered By Your Clients. Coordinate Cash Settlements Offline And Release For System Fulfillment.
            </p>

            {orders.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {orders.map((order) => {
                  const isPendingPayment = order.status === 'pending_customer_payment';
                  const isPendingApproval = order.status === 'agent_approval_pending';
                  const canApprove = isPendingPayment || isPendingApproval;

                  return (
                    <div key={order.id} style={{
                      background: 'var(--surface-2)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-5)',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 'var(--space-4)'
                    }}>
                      <div>
                        {/* Order Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', fontFamily: 'var(--font-brand)' }}>ID: {order.id}</span>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                          <span style={{ fontSize: '0.78rem', color: 'var(--silver)' }}>{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>

                        {/* Order Meta details */}
                        <div style={{ marginBottom: 'var(--space-3)' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' }}>
                            {order.buyer_name || 'Anonymous Scientist'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', fontFamily: 'var(--font-brand)' }}>
                            {order.buyer_email ? `@${order.buyer_email.split('@')[0]}` : ''}
                          </div>
                        </div>

                        {/* Payment & Shipping Meta info */}
                        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--silver-light)' }}>
                            <span style={{ color: 'var(--grey-400)' }}>Total:</span> <strong style={{ color: 'var(--teal)' }}>${Number(order.total).toFixed(2)}</strong>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--silver-light)', textTransform: 'capitalize' }}>
                            <span style={{ color: 'var(--grey-400)' }}>Method:</span> {order.fulfillment_method === 'agent_pickup' ? 'Agent Pickup' : 'Delivery'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--silver-light)', textTransform: 'uppercase' }}>
                            <span style={{ color: 'var(--grey-400)' }}>Payment:</span> {order.payment_method === 'cashapp' ? 'Cash App' : order.payment_method === 'apple_pay' ? 'Apple Pay' : order.payment_method}
                          </div>
                        </div>
                      </div>

                      {/* Right Action buttons and badge */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
                        <span className={`badge ${
                          order.status === 'cancelled' ? 'badge-red' :
                          order.status.startsWith('approved_') || order.status === 'delivered' || order.status === 'shipped' ? 'badge-teal' :
                          'badge-silver'
                        }`} style={{ fontSize: '0.7rem' }}>
                          {order.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </span>

                        {canApprove && (
                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                              className="btn btn-secondary btn-sm"
                              style={{ border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.75rem' }}
                            >
                              Cancel Order
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(
                                order.id,
                                order.fulfillment_method === 'agent_pickup' ? 'approved_pickup' : 'approved_ship'
                              )}
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.75rem' }}
                            >
                              Approve Offline Payment
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', opacity: 0.6 }}>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--teal)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block', margin: '0 auto var(--space-3)' }}
                >
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
                <h4 style={{ color: 'var(--silver)' }}>No Referred Orders Found</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>Client Transaction Registrations Will Sync Dynamically To This Dashboard Panel.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: Discount Coupons */}
        {activeTab === 'Coupons' && <AgentCoupons agentId={userProfile.id} />}

        {/* TAB: Researcher Messages */}
        {activeTab === 'Messages' && (
          <AgentMessages agentId={userProfile.id} researchers={researchers} />
        )}

        {/* TAB 5: Storefront Configuration */}
        {activeTab === 'Storefront Config' && (
          <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Configure Storefront Settings
            </h3>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
              Tailor Your White-Label Visual Identity, Bio Details, And Private Mobile Cash Accounts.
            </p>

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Display Storefront Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Storefront URL Slug</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', paddingLeft: 'var(--space-3)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)', userSelect: 'none' }}>pepnationlab.com/</span>
                    <input
                      type="text"
                      className="form-input"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Marketing Tagline</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="E.g. The Apex Level In Scientific Experimentation Compounds."
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Biography Details</label>
                <textarea
                  className="form-input"
                  placeholder="Provide Additional Laboratory Context Or Institutional Accreditations..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={{ minHeight: 100, resize: 'vertical' }}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Brand Color Highlight</label>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{ width: 44, height: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{ fontFamily: 'var(--font-brand)' }}
                    />
                  </div>
                </div>
              </div>

              <h4 style={{ color: 'var(--teal)', fontSize: '0.9rem', marginTop: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Private Mobile Payment Handles
              </h4>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Zelle Transfer Account</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. payments@myshop.com"
                    value={zelleHandle}
                    onChange={(e) => setZelleHandle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cash App Handle</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. $MyStorefront"
                    value={cashappHandle}
                    onChange={(e) => setCashappHandle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Venmo Handle</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. @MyStorefront"
                    value={venmoHandle}
                    onChange={(e) => setVenmoHandle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Apple Pay Receiver</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. billing@myshop.com"
                    value={applePayHandle}
                    onChange={(e) => setApplePayHandle(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="submit" className="btn btn-primary" style={{ minWidth: 200 }} disabled={loading}>
                  {loading ? 'Saving Settings...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
