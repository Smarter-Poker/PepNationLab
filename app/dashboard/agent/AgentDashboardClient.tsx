'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';
import AgentCoupons from '@/components/AgentCoupons';
import AgentMessages from '@/components/AgentMessages';
import AgentStoreProducts from '@/components/AgentStoreProducts';
import AgentSales from '@/components/AgentSales';
import AgentSubAgents from '@/components/AgentSubAgents';
import AgentInventory from '@/components/AgentInventory';
import AgentInbox from '@/components/AgentInbox';
import AgentOverview from '@/components/AgentOverview';
import AgentStorefrontConfig from '@/components/AgentStorefrontConfig';
import AgentOrders from '@/components/AgentOrders';
import AgentLedger from '@/components/AgentLedger';
import AgentBundles from '@/components/AgentBundles';
import AgentCommissions from '@/components/AgentCommissions';
import AgentSetupChecklist from '@/components/AgentSetupChecklist';
import MessageBell from '@/components/MessageBell';
import { sanitizeUsername } from '@/lib/usernames';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  tier: string | null;
  is_super_agent?: boolean;
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
  qr_code_data?: string | null;
  payment_handles: Record<string, any> | null;
  warehouse_address?: Record<string, any> | null;
  is_active?: boolean | null;
  shippo_api_key: string | null;
  shippo_api_key_present?: boolean;
  shippo_api_key_last4?: string | null;
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
  tracking_number?: string | null;
  label_url?: string | null;
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

  const [activeTab, setActiveTab] = useState<'Overview' | 'Sales & Carts' | 'Researchers' | 'My Sub-Agents' | 'Orders' | 'Store Products' | 'Research Bundles' | 'Inventory' | 'Accounting' | 'Commissions' | 'Coupons' | 'Messages' | 'Storefront Config' | 'Settings'>('Overview');
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(initialAgentProfile);
  const [orders, setOrders] = useState<Order[]>(initialOrders);



  // Storefront Config Form State
  const [displayName, setDisplayName] = useState(agentProfile?.display_name ?? '');
  const [slug, setSlug] = useState(agentProfile?.slug ?? '');
  const [logoUrl, setLogoUrl] = useState(agentProfile?.logo_url ?? '');
  const [tagline, setTagline] = useState(agentProfile?.tagline ?? '');
  const [bio, setBio] = useState(agentProfile?.bio ?? '');
  const [primaryColor, setPrimaryColor] = useState(agentProfile?.primary_color ?? '#00C4BC');
  const [zelleHandle, setZelleHandle] = useState(agentProfile?.payment_handles?.zelle ?? '');
  const [cashappHandle, setCashappHandle] = useState(agentProfile?.payment_handles?.cashapp ?? '');
  const [venmoHandle, setVenmoHandle] = useState(agentProfile?.payment_handles?.venmo ?? '');
  const [applePayHandle, setApplePayHandle] = useState(agentProfile?.payment_handles?.apple_pay ?? '');
  const [shippoApiKey, setShippoApiKey] = useState(agentProfile?.shippo_api_key ?? '');

  // Setup Form State (If no profile exists yet)
  const [setupDisplayName, setSetupDisplayName] = useState('');
  const [setupSlug, setSetupSlug] = useState('');
  const [setupTagline, setSetupTagline] = useState('');

  // Payment handles (required at setup so storefront can show pay-to info)
  const [setupZelle, setSetupZelle] = useState('');
  const [setupCashApp, setSetupCashApp] = useState('');
  const [setupVenmo, setSetupVenmo] = useState('');
  const [setupApplePay, setSetupApplePay] = useState('');

  // Warehouse address (required for Shippo "from" address)
  const [setupWhName, setSetupWhName] = useState('');
  const [setupWhStreet1, setSetupWhStreet1] = useState('');
  const [setupWhStreet2, setSetupWhStreet2] = useState('');
  const [setupWhCity, setSetupWhCity] = useState('');
  const [setupWhState, setSetupWhState] = useState('');
  const [setupWhZip, setSetupWhZip] = useState('');

  // Status and Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedStorefront, setCopiedStorefront] = useState(false);
  
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Create Researcher Modal State
  const [showCreateResearcher, setShowCreateResearcher] = useState(false);
  const [crFullName, setCrFullName] = useState('');
  const [crUsername, setCrUsername] = useState('');
  const [crPassword, setCrPassword] = useState('');
  const [crLoading, setCrLoading] = useState(false);
  const [crError, setCrError] = useState('');
  const [crSuccess, setCrSuccess] = useState('');
  const [researcherList, setResearcherList] = useState<Researcher[]>(initialResearchers);

  // Reset Password Modal State (for researchers & sub-agents)
  const [resetPwUser, setResetPwUser] = useState<{ id: string; name: string; username: string } | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwSaving, setResetPwSaving] = useState(false);

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
    if (cleanSlug.length < 3 || cleanSlug.length > 30) {
      setError('Storefront URL Slug Length Must Be Between 3 And 30 Characters.');
      return;
    }
    if (!setupDisplayName.trim()) {
      setError('Storefront Display Name Is Required.');
      return;
    }

    // Block submit until ALL payment handles are filled in. The storefront
    // needs at least one offline payment instruction shown to researchers,
    // and we require all four so the agent has full coverage on day one.
    const zelle = setupZelle.trim();
    const cashapp = setupCashApp.trim();
    const venmo = setupVenmo.trim();
    const applePay = setupApplePay.trim();
    if (!zelle || !cashapp || !venmo || !applePay) {
      setError('All Four Payment Handles Are Required (Zelle, Cash App, Venmo, Apple Pay).');
      return;
    }

    // Block submit until warehouse address is filled in (Shippo From Address).
    const whName = setupWhName.trim();
    const whStreet1 = setupWhStreet1.trim();
    const whCity = setupWhCity.trim();
    const whState = setupWhState.trim();
    const whZip = setupWhZip.trim();
    if (!whName || !whStreet1 || !whCity || !whState || !whZip) {
      setError('Warehouse Address Is Required (Name, Street, City, State, Zip).');
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
          is_active: true,
          payment_handles: {
            zelle,
            cashapp,
            venmo,
            apple_pay: applePay,
          },
          warehouse_address: {
            name: whName,
            street1: whStreet1,
            street2: setupWhStreet2.trim() || null,
            city: whCity,
            state: whState,
            zip: whZip,
          },
        })
        .select()
        .single();

      if (insertError) {
        const msg = (insertError.message || '').toLowerCase();
        if (msg.includes('check') || msg.includes('reserved') || msg.includes('unique') || msg.includes('duplicate')) {
          throw new Error('Slug Is Reserved Or Already In Use. Please Choose A Different One.');
        }
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

  const copyStorefrontLink = () => {
    navigator.clipboard.writeText(storefrontUrl);
    setCopiedStorefront(true);
    setTimeout(() => setCopiedStorefront(false), 2000);
  };

  // Compute stats. Order count excludes cancelled to stay consistent with
  // the revenue total below — otherwise the dashboard would proudly count
  // cancelled orders while excluding their revenue, which reads as a bug.
  const activeResearchersCount = researcherList.length;
  const nonCancelledOrders = orders.filter((o) => o.status !== 'cancelled');
  const activeOrdersCount = nonCancelledOrders.length;
  const totalRevenue = nonCancelledOrders.reduce((acc, o) => acc + Number(o.total), 0);

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

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              <h4 style={{ color: 'var(--teal)', fontSize: '0.95rem', marginBottom: 'var(--space-2)' }}>Payment Handles</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-3)' }}>
                Shown To Researchers After Checkout. All Four Are Required.
              </p>
              <div className="form-group">
                <label className="form-label">Zelle Handle / Email</label>
                <input type="text" className="form-input" value={setupZelle} onChange={(e) => setSetupZelle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Cash App Handle ($)</label>
                <input type="text" className="form-input" value={setupCashApp} onChange={(e) => setSetupCashApp(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Venmo Handle (@)</label>
                <input type="text" className="form-input" value={setupVenmo} onChange={(e) => setSetupVenmo(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Apple Pay (Phone / Email)</label>
                <input type="text" className="form-input" value={setupApplePay} onChange={(e) => setSetupApplePay(e.target.value)} required />
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              <h4 style={{ color: 'var(--teal)', fontSize: '0.95rem', marginBottom: 'var(--space-2)' }}>Warehouse Address</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-3)' }}>
                Used As The Ship-From Address When Buying Labels. Required Before Generating Shippo Labels.
              </p>
              <div className="form-group">
                <label className="form-label">Warehouse Contact Name</label>
                <input type="text" className="form-input" value={setupWhName} onChange={(e) => setSetupWhName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Street Address Line 1</label>
                <input type="text" className="form-input" value={setupWhStreet1} onChange={(e) => setSetupWhStreet1(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Street Address Line 2 (Optional)</label>
                <input type="text" className="form-input" value={setupWhStreet2} onChange={(e) => setSetupWhStreet2(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input type="text" className="form-input" value={setupWhCity} onChange={(e) => setSetupWhCity(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input type="text" className="form-input" maxLength={2} value={setupWhState} onChange={(e) => setSetupWhState(e.target.value.toUpperCase())} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Zip</label>
                  <input type="text" className="form-input" maxLength={10} value={setupWhZip} onChange={(e) => setSetupWhZip(e.target.value)} required />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-4)', width: '100%' }} disabled={loading}>
              {loading ? 'Activating Profile...' : 'Continue'}
            </button>
          </form>

          <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="btn btn-ghost btn-sm" style={{ color: 'var(--grey-400)' }}>
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const MENU_ITEMS = [
    { id: 'Overview', label: 'Overview', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg> },
    { id: 'Orders', label: 'Orders & Fulfillment', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg> },
    { id: 'Inventory', label: 'Inventory Management', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
    { id: 'Accounting', label: 'Accounting', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
    { id: 'Commissions', label: 'Commissions', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
    { id: 'Sales & Carts', label: 'Sales & Charts', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
    { id: 'Researchers', label: 'Researchers', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
    ...(userProfile.is_super_agent ? [{ id: 'My Sub-Agents', label: 'My Sub-Agents', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }] : []),
    { id: 'Coupons', label: 'Coupons', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
    { id: 'Store Products', label: 'Store Products', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
    { id: 'Research Bundles', label: 'Bundles', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
    { id: 'Messages', label: 'Messages', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
    { id: 'Storefront Config', label: 'Storefront Configure', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
    { id: 'Settings', label: 'Account Settings', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      {/* Mobile Top Navbar */}
      <nav className="nav" style={{ justifyContent: 'space-between', padding: '0 var(--space-4)', display: 'flex' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button 
            className="btn btn-ghost btn-sm hamburger-btn" 
            style={{ padding: '4px' }} 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          
          <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <img src="/images/back-arrow.png" alt="Back" width={40} height={26} style={{ opacity: 0.85, transition: 'opacity 0.2s' }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')} />
          </Link>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontFamily: 'var(--font-brand)', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--teal)' }}>
            AGENT STOREFRONT
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <MessageBell onViewAll={() => { setActiveTab('Messages'); setIsMobileMenuOpen(false); }} />
          <span className="hide-on-mobile" style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{agentProfile.display_name}</span>
        </div>
      </nav>

      {/* Overlay to close menu when clicking outside */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 64,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 40,
            cursor: 'pointer'
          }}
        />
      )}

      {/* Sidebar */}
      <div className="sidebar" style={{ 
        transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as any); setIsMobileMenuOpen(false); setError(null); setSuccess(null); }}
              className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
              style={{ background: 'transparent', width: '100%', textAlign: 'left', border: 'none', borderLeft: activeTab === item.id ? '3px solid var(--teal)' : '3px solid transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%' }}>
                {item.icon}
                <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>{item.label}</span>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: 'var(--space-4)' }}>
          <button 
            className="sidebar-nav-item" 
            onClick={() => { setActiveTab('Storefront Config' as any); setIsMobileMenuOpen(false); }}
            style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /><rect x="19" y="14" width="2" height="2" /><rect x="14" y="19" width="2" height="2" /><rect x="19" y="19" width="2" height="2" />
              </svg>
              <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>QR Code</span>
            </div>
          </button>
          <Link href="/account/security" className="sidebar-nav-item" style={{ display: 'block', textDecoration: 'none' }} onClick={() => setIsMobileMenuOpen(false)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>Account Security</span>
            </div>
          </Link>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="sidebar-nav-item" style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--red)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>Sign Out</span>
              </div>
            </button>
          </form>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .hide-on-mobile { display: none !important; }
        }
      `}} />

      <div className="dashboard-main" style={{ minHeight: '100vh' }}>
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

          {/* First-Time Agent Setup Walkthrough */}
          <AgentSetupChecklist
            agentProfile={agentProfile}
            onOpenConfig={() => { setActiveTab('Storefront Config'); setIsMobileMenuOpen(false); }}
          />

        {/* Sales & Live Carts Tab */}
        {activeTab === 'Sales & Carts' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentSales />
          </div>
        )}

        {/* My Sub-Agents Tab */}
        {activeTab === 'My Sub-Agents' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentSubAgents agentId={userProfile.id} />
          </div>
        )}

        {/* Store Products Tab */}
        {activeTab === 'Store Products' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentStoreProducts agentId={userProfile.id} />
          </div>
        )}

        {/* Research Bundles Tab */}
        {activeTab === 'Research Bundles' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentBundles agentId={userProfile.id} />
          </div>
        )}

        {/* TAB X: Inventory Configuration */}
        {activeTab === 'Inventory' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentInventory agentId={userProfile.id} />
          </div>
        )}

        {/* TAB: Accounting */}
        {activeTab === 'Accounting' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentLedger agentId={userProfile.id} />
          </div>
        )}

        {/* TAB: Commissions */}
        {activeTab === 'Commissions' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentCommissions />
          </div>
        )}

        {/* TAB: Overview — breaks out of container for full-width image, flush to header */}
        {activeTab === 'Overview' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out', marginLeft: 'calc(-1 * var(--space-6))', marginRight: 'calc(-1 * var(--space-6))', marginTop: 'calc(-1 * var(--space-8))', width: 'calc(100% + var(--space-6) * 2)' }}>
            <AgentOverview 
              activeResearchersCount={activeResearchersCount}
              activeOrdersCount={activeOrdersCount}
              totalRevenue={totalRevenue}
              storefrontUrl={storefrontUrl}
              copyStorefrontLink={() => {
                navigator.clipboard.writeText(storefrontUrl);
                setCopiedStorefront(true);
                setTimeout(() => setCopiedStorefront(false), 2000);
              }}
              copiedStorefront={copiedStorefront}
              agentProfile={agentProfile}
              orders={orders}
              onNavigate={(tab) => { setActiveTab(tab as any); setIsMobileMenuOpen(false); }}
            />
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
                        value={crUsername} onChange={e => setCrUsername(sanitizeUsername(e.target.value))}
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
                        <th style={{ padding: 'var(--space-3) 0', fontWeight: 600 }}>Credentials</th>
                        <th style={{ padding: 'var(--space-3) 0', fontWeight: 600 }}>Created</th>
                        <th style={{ padding: 'var(--space-3) 0', fontWeight: 600 }}>Status</th>
                        {userProfile.is_super_agent && (
                          <th style={{ padding: 'var(--space-3) 0', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {researcherList.map((res) => (
                        <tr key={res.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--silver-light)' }}>
                          <td style={{ padding: 'var(--space-3) 0', fontWeight: 500 }}>{res.full_name || 'Anonymous Researcher'}</td>
                          <td style={{ padding: 'var(--space-3) 0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--teal)' }}>@{res.username ?? res.email.split('@')[0]}</span>
                              <button
                                onClick={() => setResetPwUser({ id: res.id, name: res.full_name || 'Researcher', username: res.username ?? res.email.split('@')[0] })}
                                style={{ fontSize: '0.7rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textAlign: 'left' }}
                              >
                                Edit Password
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-3) 0' }}>{new Date(res.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: 'var(--space-3) 0' }}>
                            <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>Active</span>
                          </td>
                          {userProfile.is_super_agent && (
                            <td style={{ padding: 'var(--space-3) 0', textAlign: 'right' }}>
                              <button 
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={async () => {
                                  if (!confirm('Promote this researcher to a Sub-Agent? They will be able to set prices for their own downline.')) return;
                                  try {
                                    const resApi = await fetch('/api/agent/promote-subagent', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ researcherId: res.id })
                                    });
                                    if (!resApi.ok) {
                                      const errData = await resApi.json();
                                      throw new Error(errData.error || 'Failed to promote');
                                    }
                                    alert('Researcher successfully promoted to Sub-Agent!');
                                    // Remove from this list since they are now a sub-agent
                                    setResearcherList(prev => prev.filter(r => r.id !== res.id));
                                  } catch (err: any) {
                                    alert(err.message);
                                  }
                                }}
                              >
                                Promote to Sub-Agent
                              </button>
                            </td>
                          )}
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
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentOrders orders={orders} setOrders={setOrders} />
          </div>
        )}

        {/* TAB: Discount Coupons */}
        {activeTab === 'Coupons' && <AgentCoupons agentId={userProfile.id} />}

        {/* TAB: Researcher Messages */}
        {activeTab === 'Messages' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            <AgentInbox agentId={userProfile.id} />
            <AgentMessages agentId={userProfile.id} researchers={researcherList} />
          </div>
        )}

        {/* TAB: Storefront Configuration */}
        {activeTab === 'Storefront Config' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentStorefrontConfig
              displayName={displayName} setDisplayName={setDisplayName}
              slug={slug} setSlug={setSlug}
              logoUrl={logoUrl} setLogoUrl={setLogoUrl}
              tagline={tagline} setTagline={setTagline}
              bio={bio} setBio={setBio}
              primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
              zelleHandle={zelleHandle} setZelleHandle={setZelleHandle}
              cashappHandle={cashappHandle} setCashappHandle={setCashappHandle}
              venmoHandle={venmoHandle} setVenmoHandle={setVenmoHandle}
              applePayHandle={applePayHandle} setApplePayHandle={setApplePayHandle}
              shippoApiKey={shippoApiKey} setShippoApiKey={setShippoApiKey}
              shippoKeyPresent={agentProfile.shippo_api_key_present ?? false}
              shippoKeyLast4={agentProfile.shippo_api_key_last4 ?? null}
              warehouseAddress={agentProfile.warehouse_address}
              isActive={agentProfile.is_active}
              agentId={userProfile.id}
            />
          </div>
        )}

        {/* TAB: Account Settings */}
        {activeTab === 'Settings' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: 600 }}>
            <h2 style={{ fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-6)', fontSize: '1.3rem' }}>Account Settings</h2>

            {/* Account Info */}
            <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
              <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>Account Information</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</span>
                  <p style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: '1rem', margin: '4px 0 0' }}>{userProfile.email?.split('@')[0] || '—'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Storefront URL</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 4 }}>
                    <p style={{ fontFamily: 'monospace', color: 'var(--white)', fontSize: '0.9rem', margin: 0 }}>{storefrontUrl}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(storefrontUrl); toast.success('Copied!'); }}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                    >Copy</button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</span>
                  <p style={{ color: 'var(--white)', fontSize: '0.9rem', margin: '4px 0 0' }}>{userProfile.full_name || '—'}</p>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
              <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>Change Password</h4>
              <SettingsPasswordForm />
            </div>
          </div>
        )}

      </div>
      </div>

      {/* Reset Password Modal (for researchers & sub-agents) */}
      {resetPwUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-metal" style={{ width: '100%', maxWidth: 400, padding: 'var(--space-6)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)', color: 'var(--white)' }}>Reset Password</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>
              User: <strong style={{ color: 'var(--white)' }}>{resetPwUser.name}</strong>
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
              Username: <strong style={{ color: 'var(--teal)', fontFamily: 'monospace' }}>{resetPwUser.username}</strong>
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!resetPwUser || !resetPwValue) return;
              setResetPwSaving(true);
              try {
                const res = await fetch('/api/agent/update-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: resetPwUser.id, newPassword: resetPwValue }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                toast.success('Password Updated Successfully');
                setResetPwUser(null);
                setResetPwValue('');
              } catch (err: any) {
                toast.error(err.message || 'Failed To Update Password');
              } finally {
                setResetPwSaving(false);
              }
            }}>
              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label">New Password</label>
                <input
                  type="text"
                  className="form-input"
                  value={resetPwValue}
                  onChange={e => setResetPwValue(e.target.value)}
                  placeholder="Minimum 8 Characters"
                  required
                  minLength={8}
                  autoComplete="off"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setResetPwUser(null); setResetPwValue(''); }} disabled={resetPwSaving}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={resetPwSaving || resetPwValue.length < 8}>
                  {resetPwSaving ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function SettingsPasswordForm() {
  const supabase = createClient();
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPw !== confirmPw) { setPwError('Passwords Do Not Match'); return; }
    if (newPw.length < 8) { setPwError('Password Must Be At Least 8 Characters'); return; }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwSuccess('Password Updated Successfully!');
      setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSuccess(''), 3000);
    } catch (err: any) {
      setPwError(err.message || 'Failed To Update Password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <form onSubmit={handleChangePw}>
      <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
        <label className="form-label">New Password</label>
        <input type="password" className="form-input" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 8 Characters" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
        <label className="form-label">Confirm New Password</label>
        <input type="password" className="form-input" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-Enter New Password" required minLength={8} autoComplete="new-password" />
      </div>
      {pwError && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>{pwError}</p>}
      {pwSuccess && <p style={{ color: 'var(--teal)', fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>{pwSuccess}</p>}
      <button type="submit" className="btn btn-primary" disabled={pwLoading || newPw.length < 8 || newPw !== confirmPw}>
        {pwLoading ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}
