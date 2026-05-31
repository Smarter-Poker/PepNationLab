'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AgentCoupons from '@/components/AgentCoupons';
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
import AgentSetupChecklist from '@/components/AgentSetupChecklist';
import MessageBell from '@/components/MessageBell';
import { sanitizeUsername } from '@/lib/usernames';
import { useTheme } from '@/components/ThemeProvider';
import PaymentMethodsPanel from '@/components/PaymentMethodsPanel';
import AvatarUpload from '@/components/AvatarUpload';
import AgentStatements from '@/components/AgentStatements';
import AgentSubInvoices from '@/components/AgentSubInvoices';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  tier: string | null;
  is_super_agent?: boolean;
  avatar_url?: string | null;
}

interface AgentProfile {
  id: string;
  slug: string;
  display_name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  qr_code_url: string | null;
  qr_code_data?: string | null;
  payment_handles: Record<string, any> | null;
  warehouse_address?: Record<string, any> | null;
  is_active?: boolean | null;
  shippo_api_key: string | null;
  shippo_api_key_present?: boolean;
  shippo_api_key_last4?: string | null;
  volume_pricing_enabled?: boolean | null;
}

interface Researcher {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  created_at: string;
  auto_approve_orders?: boolean;
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

  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(initialAgentProfile);
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // Storefront Config Form State
  const [displayName, setDisplayName] = useState(agentProfile?.display_name ?? '');
  const [slug, setSlug] = useState(agentProfile?.slug ?? '');
  const [logoUrl, setLogoUrl] = useState(agentProfile?.logo_url ?? '');
  const [primaryColor, setPrimaryColor] = useState(agentProfile?.primary_color ?? '#00C4BC');
  const [volumePricingEnabled, setVolumePricingEnabled] = useState<boolean>(agentProfile?.volume_pricing_enabled ?? true);

  const handlesEmpty = !!agentProfile && (!agentProfile.payment_handles || Object.keys(agentProfile.payment_handles || {}).every((k) => !(agentProfile.payment_handles as any)[k]));
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as any;
  
  const defaultTab = (initialAgentProfile && (!initialAgentProfile.payment_handles || Object.keys(initialAgentProfile.payment_handles).every((k) => !initialAgentProfile.payment_handles![k]))) ? 'Storefront Config' : 'Overview';
  const [activeTab, setActiveTabState] = useState<'Overview' | 'Sales & Carts' | 'Researchers' | 'My Sub-Agents' | 'Orders' | 'Store Products' | 'Research Bundles' | 'Inventory' | 'Accounting' | 'Statements' | 'Sub-Agent Invoices' | 'Coupons' | 'Storefront Config' | 'Settings'>(tabParam || defaultTab);

  const setActiveTab = (tab: typeof activeTab) => {
    setActiveTabState(tab);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('tab', tab);
    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const newTab = tabParam || defaultTab;
    if (newTab !== activeTab) {
      setActiveTabState(newTab);
    }
  }, [tabParam, defaultTab, activeTab]);

  // Setup Form State (If no profile exists yet)
  const [setupDisplayName, setSetupDisplayName] = useState('');
  const [setupSlug, setSetupSlug] = useState('');

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
  const [togglingTrust, setTogglingTrust] = useState<string | null>(null);

  // Reset Password Modal State (for researchers & sub-agents)
  const [resetPwUser, setResetPwUser] = useState<{ id: string; name: string; username: string } | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwSaving, setResetPwSaving] = useState(false);

  // Promote Sub-Agent Modal State
  const [promoteResearcher, setPromoteResearcher] = useState<Researcher | null>(null);
  const [promoteLoading, setPromoteLoading] = useState(false);

  const handleToggleTrust = async (targetUserId: string, currentStatus: boolean, isSubAgent: boolean = false) => {
    setTogglingTrust(targetUserId);
    try {
      const res = await fetch('/api/agent/trust', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, auto_approve_orders: !currentStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update auto-approve setting');
      
      toast.success(data.auto_approve_orders ? 'Auto-Approve Enabled' : 'Auto-Approve Disabled');
      
      if (!isSubAgent) {
        setResearcherList(prev => prev.map(r => r.id === targetUserId ? { ...r, auto_approve_orders: data.auto_approve_orders } : r));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTogglingTrust(null);
    }
  };

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

  async function handlePromoteResearcher() {
    if (!promoteResearcher) return;
    setPromoteLoading(true);
    try {
      const resApi = await fetch('/api/agent/promote-subagent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researcherId: promoteResearcher.id })
      });
      if (!resApi.ok) {
        const errData = await resApi.json();
        throw new Error(errData.error || 'Failed to promote');
      }
      toast.success('Researcher successfully promoted to Sub-Agent!');
      setResearcherList(prev => prev.filter(r => r.id !== promoteResearcher.id));
      setPromoteResearcher(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPromoteLoading(false);
    }
  }

  const originUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? '');
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

    // Block submit until AT LEAST ONE payment handle is filled in. The storefront
    // needs at least one offline payment instruction shown to researchers.
    const zelle = setupZelle.trim();
    const cashapp = setupCashApp.trim();
    const venmo = setupVenmo.trim();
    const applePay = setupApplePay.trim();
    // Require at least one payment method at setup; agents add more later in Settings
    if (!zelle && !cashapp && !venmo && !applePay) {
      setError('At Least One Payment Method Is Required (Zelle, Cash App, Venmo, Or Apple Cash).');
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
          is_active: true,
          payment_handles: {
            zelle,
            cashapp,
            venmo,
            apple_cash: applePay,
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
      setSlug(data.slug ?? '');
      setLogoUrl(data.logo_url ?? '');
      setPrimaryColor(data.primary_color ?? '#00C4BC');
      setVolumePricingEnabled(data.volume_pricing_enabled ?? true);
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
  const collectedStatuses = ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'];
  const totalRevenue = orders
    .filter(o => collectedStatuses.includes(o.status))
    .reduce((acc, o) => acc + Number(o.total), 0);

  // If agent has no profile setup yet, show launch storefront screen
  if (!agentProfile) {
    return (
      <div className="container-sm section" style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="card-metal stagger-fade-in" style={{ width: '100%', maxWidth: 550, padding: 'var(--space-8)' }}>
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
            <h1 className="animated-gradient-text" style={{ fontSize: '1.8rem', color: 'var(--teal)', marginBottom: 'var(--space-2)' }}>Launch Storefront</h1>
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
            <div className="grid-2">
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
                <div style={{ display: 'flex', alignItems: 'center', height: 46, background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', paddingLeft: 'var(--space-3)', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)', userSelect: 'none', flexShrink: 0 }}>pepnationlab.com/</span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. bioscience"
                    value={setupSlug}
                    onChange={(e) => setSetupSlug(e.target.value)}
                    style={{ background: 'transparent', border: 'none', boxShadow: 'none', height: '100%', paddingTop: 0, paddingBottom: 0, flex: 1, minWidth: 0 }}
                    required
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', position: 'absolute', marginTop: 4 }}>
                  Lowercase Letters, Numbers, And Hyphens Only. No Spaces.
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              <h4 style={{ color: 'var(--teal)', fontSize: '0.95rem', marginBottom: 'var(--space-2)' }}>Payment Handles</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-3)' }}>
                Shown To Researchers After Checkout. At Least One Is Required.
              </p>
              <div className="grid-2">
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Zelle Handle / Email</label>
                  <input type="text" className="form-input" value={setupZelle} onChange={(e) => setSetupZelle(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Cash App Handle ($)</label>
                  <input type="text" className="form-input" value={setupCashApp} onChange={(e) => setSetupCashApp(e.target.value)} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Venmo Handle (@)</label>
                  <input type="text" className="form-input" value={setupVenmo} onChange={(e) => setSetupVenmo(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Apple Cash (Phone / Email)</label>
                  <input type="text" className="form-input" value={setupApplePay} onChange={(e) => setSetupApplePay(e.target.value)} />
                </div>
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
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">City</label>
                  <input type="text" className="form-input" value={setupWhCity} onChange={(e) => setSetupWhCity(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">State</label>
                  <input type="text" className="form-input" maxLength={2} value={setupWhState} onChange={(e) => setSetupWhState(e.target.value.toUpperCase())} required />
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
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
    ...(!userProfile.tier?.includes('sub-agent') ? [{ id: 'Statements', label: 'Admin Statements', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> }] : []),
    ...(userProfile.is_super_agent || userProfile.tier?.includes('sub-agent') ? [{ id: 'Sub-Agent Invoices', label: userProfile.is_super_agent ? 'Sub-Agent Invoices' : 'My Invoices', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> }] : []),
    { id: 'Sales & Carts', label: 'Sales & Carts', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
    { id: 'Researchers', label: 'Researchers', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
    ...(userProfile.is_super_agent ? [{ id: 'My Sub-Agents', label: 'My Sub-Agents', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }] : []),
    { id: 'Coupons', label: 'Coupons', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
    { id: 'Store Products', label: 'Store Products', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
    { id: 'Research Bundles', label: 'Bundles', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
    { id: 'Storefront Config', label: 'Storefront Configure', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
    { id: 'Settings', label: 'Account Settings', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      {/* Mobile Top Navbar (Global) */}
      <Navbar onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} title={initialAgentProfile?.display_name || userProfile.full_name || 'AGENT DASHBOARD'} />

      {/* Overlay to close menu when clicking outside */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 60,
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
        overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {MENU_ITEMS.map((item) => {
            const isDisabled = handlesEmpty && item.id !== 'Storefront Config';
            return (
              <button
                key={item.id}
                onClick={() => { 
                  if (isDisabled) return;
                  setActiveTab(item.id as any); 
                  setIsMobileMenuOpen(false); 
                  setError(null); 
                  setSuccess(null); 
                }}
                className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
                style={{ 
                  background: 'transparent', 
                  width: '100%', 
                  textAlign: 'left', 
                  border: 'none', 
                  borderLeft: activeTab === item.id ? '3px solid var(--teal)' : '3px solid transparent',
                  opacity: isDisabled ? 0.4 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%' }}>
                  {item.icon}
                  <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>{item.label}</span>
                </div>
              </button>
            );
          })}
          {/* ── Additional Action Links (merged into same scroll view) ── */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: 'var(--space-4) 0' }} />

          {agentProfile && (
            <>
              <button
                className="sidebar-nav-item"
                onClick={() => { copyStorefrontLink(); setIsMobileMenuOpen(false); }}
                style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', borderLeft: '3px solid transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', color: copiedStorefront ? 'var(--teal)' : 'currentColor', transition: 'color 0.2s' }}>
                    {copiedStorefront ? '✓ Link Copied!' : 'Copy Storefront Link'}
                  </span>
                </div>
              </button>

              <a
                href={storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sidebar-nav-item"
                style={{ display: 'block', textDecoration: 'none', borderLeft: '3px solid transparent' }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>Visit My Storefront</span>
                </div>
              </a>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: 'var(--space-2) 0' }} />
            </>
          )}

          {/* ── QR Code ── */}
          <button 
            className="sidebar-nav-item" 
            onClick={() => { setActiveTab('Storefront Config' as any); setIsMobileMenuOpen(false); }}
            style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', borderLeft: '3px solid transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /><rect x="19" y="14" width="2" height="2" /><rect x="14" y="19" width="2" height="2" /><rect x="19" y="19" width="2" height="2" />
              </svg>
              <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>QR Code</span>
            </div>
          </button>

          {/* ── Notification Settings ── */}
          <button
            type="button"
            className="sidebar-nav-item"
            onClick={() => {
              // Open the Settings tab (which contains notification prefs).
              // Also trigger the browser push permission dialog if not yet decided.
              setActiveTab('Settings');
              setIsMobileMenuOpen(false);
              if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                Notification.requestPermission();
              }
            }}
            style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', borderLeft: '3px solid transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>Notification Settings</span>
            </div>
          </button>

          {/* ── Account Security ── */}
          <Link href="/account/security" className="sidebar-nav-item" style={{ display: 'block', textDecoration: 'none', borderLeft: '3px solid transparent' }} onClick={() => setIsMobileMenuOpen(false)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>Account Security</span>
            </div>
          </Link>

          {/* ── Sign Out ── */}
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="sidebar-nav-item" style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--red)', borderLeft: '3px solid transparent', paddingBottom: 'max(var(--space-8), env(safe-area-inset-bottom, 32px))' }}>
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
        <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: activeTab === 'Overview' ? 0 : 'var(--space-12)' }}>
          {/* Status Alerts */}
          {error && (
            <div style={{ borderLeft: '3px solid var(--red)', background: 'var(--red-bg)', padding: 'var(--space-4)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 'var(--space-6)' }}>
              <p style={{ color: 'var(--red)', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>{error}</p>
            </div>
          )}
          {success && (
            <div style={{ borderLeft: '3px solid var(--teal)', background: 'rgba(192,184,168,0.06)', padding: 'var(--space-4)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 'var(--space-6)' }}>
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

        {/* TAB: Admin Statements */}
        {activeTab === 'Statements' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentStatements />
          </div>
        )}

        {/* TAB: Sub-Agent Invoices */}
        {activeTab === 'Sub-Agent Invoices' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentSubInvoices isSuperAgent={!!userProfile.is_super_agent} />
          </div>
        )}

        {/* TAB: Overview — full-bleed image fills 100dvh minus navbar */}
        {activeTab === 'Overview' && (
          <div style={{
            animation: 'fadeIn 0.3s ease-out',
            /* Bust out of the container so the image goes edge-to-edge */
            marginLeft: 'calc(-1 * var(--container-px, var(--space-6)))',
            marginRight: 'calc(-1 * var(--container-px, var(--space-6)))',
            marginTop: 'calc(-1 * var(--space-8))',
          }}>
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
            {/* Promote Researcher Modal */}
            {promoteResearcher && (
              <div
                onClick={() => setPromoteResearcher(null)}
                style={{
                  position: 'fixed', inset: 0,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  zIndex: 1000,
                  padding: '16px 16px 32px',
                  paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
                  background: 'rgba(0,0,0,0.6)',
                  overflowY: 'auto',
                }}
              >
                {/* Brushed-steel outer frame */}
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    maxWidth: 480, width: '100%',
                    borderRadius: 20,
                    padding: 10,
                    background: 'linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%)',
                    boxShadow: '0 8px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4)',
                    flexShrink: 0,
                  }}
                >
                  {/* Inner dark panel */}
                  <div style={{
                    borderRadius: 12,
                    background: 'linear-gradient(180deg, #1a1f2e 0%, #141820 40%, #111520 100%)',
                    padding: '28px 28px 24px',
                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
                    position: 'relative',
                  }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                      <div>
                        <h3 style={{
                          fontSize: '1.45rem', fontWeight: 700, color: '#ffffff',
                          margin: 0, marginBottom: 6,
                          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                          fontFamily: 'var(--font-brand)',
                        }}>
                          Promote To Sub-Agent
                        </h3>
                      </div>
                      {/* X close button */}
                      <button
                        type="button"
                        onClick={() => setPromoteResearcher(null)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#8a9ab0', fontSize: '1.3rem', fontWeight: 700,
                          lineHeight: 1, padding: '2px 4px', marginTop: -2,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#8a9ab0')}
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>

                    <p style={{ color: '#d0d8e4', fontSize: '0.95rem', marginBottom: 30, lineHeight: 1.5 }}>
                      Promote This Researcher To A Sub-Agent? They Will Be Able To Set Prices For Their Own Downline.
                    </p>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '15px' }}
                        onClick={() => setPromoteResearcher(null)}
                        disabled={promoteLoading}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '15px' }}
                        onClick={handlePromoteResearcher}
                        disabled={promoteLoading}
                      >
                        {promoteLoading ? 'Promoting...' : 'Promote To Sub-Agent'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Create Researcher Modal */}
            {showCreateResearcher && (
              <div
                onClick={() => setShowCreateResearcher(false)}
                style={{
                  position: 'fixed', inset: 0,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  zIndex: 1000,
                  padding: '16px 16px 32px',
                  paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
                  background: 'rgba(0,0,0,0.6)',
                  overflowY: 'auto',
                }}
              >
                {/* Brushed-steel outer frame */}
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    maxWidth: 480, width: '100%',
                    borderRadius: 20,
                    padding: 10,
                    background: 'linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%)',
                    boxShadow: '0 8px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4)',
                    flexShrink: 0,
                  }}
                >
                  {/* Inner dark panel */}
                  <div style={{
                    borderRadius: 12,
                    background: 'linear-gradient(180deg, #1a1f2e 0%, #141820 40%, #111520 100%)',
                    padding: '28px 28px 24px',
                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
                    position: 'relative',
                  }}>

                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                      <div>
                        <h3 style={{
                          fontSize: '1.45rem', fontWeight: 700, color: '#ffffff',
                          margin: 0, marginBottom: 6,
                          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                          fontFamily: 'var(--font-brand)',
                        }}>
                          Create Researcher Account
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#8a9ab0', margin: 0 }}>
                          Account Will Be Linked To Your Agency
                        </p>
                      </div>
                      {/* X close button */}
                      <button
                        type="button"
                        onClick={() => setShowCreateResearcher(false)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#8a9ab0', fontSize: '1.3rem', fontWeight: 700,
                          lineHeight: 1, padding: '2px 4px', marginTop: -2,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#8a9ab0')}
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Error / success banners */}
                    {crError && (
                      <div style={{
                        background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.35)',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                        fontSize: '0.82rem', color: '#fc8181',
                      }}>{crError}</div>
                    )}
                    {crSuccess && (
                      <div style={{
                        background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.3)',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                        fontSize: '0.82rem', color: 'var(--teal)',
                      }}>{crSuccess}</div>
                    )}

                    <form onSubmit={handleCreateResearcher} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                      {/* Full Name */}
                      <div style={{ marginBottom: 18 }}>
                        <label style={{
                          display: 'block', fontSize: '0.92rem', fontWeight: 700,
                          color: '#d0d8e4', marginBottom: 8,
                        }}>Full Name</label>
                        <input
                          type="text"
                          value={crFullName}
                          onChange={e => setCrFullName(e.target.value)}
                          required
                          placeholder=""
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'linear-gradient(180deg, #0a0c14 0%, #0d1018 100%)',
                            border: '1px solid #2a3045',
                            borderRadius: 8,
                            padding: '13px 14px',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            outline: 'none',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7), inset 0 1px 3px rgba(0,0,0,0.5)',
                            caretColor: '#00C4BC',
                          }}
                          onFocus={e => { e.currentTarget.style.border = '1px solid #00C4BC'; }}
                          onBlur={e => { e.currentTarget.style.border = '1px solid #2a3045'; }}
                        />
                      </div>

                      {/* Username */}
                      <div style={{ marginBottom: 6 }}>
                        <label style={{
                          display: 'block', fontSize: '0.92rem', fontWeight: 700,
                          color: '#d0d8e4', marginBottom: 8,
                        }}>Username</label>
                        <input
                          type="text"
                          value={crUsername}
                          onChange={e => setCrUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                          required
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder=""
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'linear-gradient(180deg, #0a0c14 0%, #0d1018 100%)',
                            border: '1px solid #2a3045',
                            borderRadius: 8,
                            padding: '13px 14px',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            outline: 'none',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7), inset 0 1px 3px rgba(0,0,0,0.5)',
                            caretColor: '#00C4BC',
                          }}
                          onFocus={e => { e.currentTarget.style.border = '1px solid #00C4BC'; }}
                          onBlur={e => { e.currentTarget.style.border = '1px solid #2a3045'; }}
                        />
                      </div>

                      {/* Temporary Password */}
                      <div style={{ marginBottom: 6 }}>
                        <label style={{
                          display: 'block', fontSize: '0.92rem', fontWeight: 700,
                          color: '#d0d8e4', marginBottom: 8,
                        }}>Temporary Password</label>
                        <input
                          type="text"
                          value={crPassword}
                          onChange={e => setCrPassword(e.target.value)}
                          required
                          placeholder="At Least 8 Characters"
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'linear-gradient(180deg, #0a0c14 0%, #0d1018 100%)',
                            border: '1px solid #2a3045',
                            borderRadius: 8,
                            padding: '13px 14px',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            outline: 'none',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7), inset 0 1px 3px rgba(0,0,0,0.5)',
                            caretColor: '#00C4BC',
                          }}
                          onFocus={e => { e.currentTarget.style.border = '1px solid #00C4BC'; }}
                          onBlur={e => { e.currentTarget.style.border = '1px solid #2a3045'; }}
                        />
                        <p style={{ fontSize: '0.76rem', color: '#5a6a7a', marginTop: 6, marginBottom: 22 }}>
                          You Set This And Tell Them Directly. No Automatic Emails Are Sent.
                        </p>
                      </div>

                      {/* Submit button */}
                      <button
                        type="submit"
                        disabled={crLoading}
                        style={{
                          width: '100%',
                          padding: '15px',
                          background: 'linear-gradient(180deg, #2a3350 0%, #1e2640 50%, #161c30 100%)',
                          border: '1px solid #3a4560',
                          borderRadius: 8,
                          color: '#ffffff',
                          fontSize: '1rem',
                          fontWeight: 700,
                          cursor: crLoading ? 'not-allowed' : 'pointer',
                          opacity: crLoading ? 0.65 : 1,
                          letterSpacing: '0.02em',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
                          transition: 'background 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={e => {
                          if (!crLoading) {
                            e.currentTarget.style.background = 'linear-gradient(180deg, #354068 0%, #263050 50%, #1a2240 100%)';
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,196,188,0.15), inset 0 1px 0 rgba(255,255,255,0.08)';
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'linear-gradient(180deg, #2a3350 0%, #1e2640 50%, #161c30 100%)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)';
                        }}
                      >
                        {crLoading ? 'Creating Account...' : 'Create Researcher Account'}
                      </button>

                    </form>
                  </div>
                </div>
              </div>
            )}


            <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>My Researchers</h3>
                <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', marginBottom: 'var(--space-4)' }}>All Researcher Accounts You Have Created</p>
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
                        <th style={{ padding: 'var(--space-3) 0', fontWeight: 600 }}>Auto Approve</th>
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
                          <td style={{ padding: 'var(--space-3) 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <label style={{
                                position: 'relative',
                                display: 'inline-block',
                                width: '36px',
                                height: '20px'
                              }}>
                                <input 
                                  type="checkbox" 
                                  checked={!!res.auto_approve_orders}
                                  onChange={() => handleToggleTrust(res.id, !!res.auto_approve_orders)}
                                  disabled={togglingTrust === res.id}
                                  style={{ opacity: 0, width: 0, height: 0 }} 
                                />
                                <span style={{
                                  position: 'absolute',
                                  cursor: togglingTrust === res.id ? 'not-allowed' : 'pointer',
                                  top: 0, left: 0, right: 0, bottom: 0,
                                  backgroundColor: res.auto_approve_orders ? 'var(--teal)' : 'var(--grey-500)',
                                  transition: '.4s',
                                  borderRadius: '20px',
                                  opacity: togglingTrust === res.id ? 0.5 : 1
                                }}>
                                  <span style={{
                                    position: 'absolute',
                                    height: '14px',
                                    width: '14px',
                                    left: res.auto_approve_orders ? '19px' : '3px',
                                    bottom: '3px',
                                    backgroundColor: 'white',
                                    transition: '.4s',
                                    borderRadius: '50%'
                                  }} />
                                </span>
                              </label>
                            </div>
                          </td>
                          {userProfile.is_super_agent && (
                            <td style={{ padding: 'var(--space-3) 0', textAlign: 'right' }}>
                              <button 
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => setPromoteResearcher(res)}
                              >
                                Promote To Sub-Agent
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


        {/* TAB: Storefront Configuration */}
        {activeTab === 'Storefront Config' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {handlesEmpty && (
              <div style={{
                background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, padding: 'var(--space-4)', marginBottom: 'var(--space-6)'
              }}>
                <h4 style={{ color: 'var(--red)', margin: '0 0 var(--space-2) 0', fontSize: '1rem' }}>Action Required: Add Payment Handles</h4>
                <p style={{ color: 'var(--red)', fontSize: '0.9rem', margin: 0 }}>
                  You must configure at least one payment method before you can access the rest of your dashboard. This ensures researchers know how to pay you.
                </p>
              </div>
            )}
            <AgentStorefrontConfig
              displayName={displayName} setDisplayName={setDisplayName}
              slug={slug} setSlug={setSlug}
              logoUrl={logoUrl} setLogoUrl={setLogoUrl}
              primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
              warehouseAddress={agentProfile?.warehouse_address}
              isActive={agentProfile?.is_active}
              volumePricingEnabled={volumePricingEnabled}
              setVolumePricingEnabled={setVolumePricingEnabled}
              agentId={userProfile.id}
              onSaveSuccess={(updatedData) => {
                if (agentProfile) {
                  setAgentProfile({ ...agentProfile, ...updatedData });
                }
              }}
              paymentMethodsNode={
                agentProfile ? (
                  <PaymentMethodsPanel
                    agentId={userProfile.id}
                    initialHandles={agentProfile.payment_handles as Record<string, string> | null}
                    onSaveSuccess={(newHandles) => {
                      setAgentProfile(prev => prev ? { ...prev, payment_handles: newHandles } : prev);
                    }}
                  />
                ) : null
              }
            />
          </div>
        )}

        {/* TAB: Account Settings */}
        {activeTab === 'Settings' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: 600 }}>
            <h2 style={{ fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-6)', fontSize: '1.3rem' }}>Account Settings</h2>

            {/* Profile Picture Upload */}
            <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
              <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Profile Picture</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)', marginTop: 0 }}>
                Upload a profile picture to show in Messenger instead of a generic initial.
              </p>
              <AvatarUpload 
                currentAvatarUrl={userProfile.avatar_url ?? null} 
                name={userProfile.full_name ?? userProfile.email?.split('@')[0] ?? 'Agent'} 
              />
            </div>

            {/* Account Info */}
            <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
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
            <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
              <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>Change Password</h4>
              <SettingsPasswordForm />
            </div>

            {/* Notification Preferences */}
            <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
              <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Notification Preferences</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)', marginTop: 0 }}>
                Manage Push Notifications For New Messages When The Tab Is Hidden.
              </p>
              <NotificationPrefsPanel />
            </div>

            {/* Theme Preferences */}
            <ThemeToggleCard />
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

function NotificationPrefsPanel() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [browserPush, setBrowserPush] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      setLoaded(true);
      return;
    }
    setPermission(Notification.permission);
    // Load saved pref from DB
    fetch('/api/messenger/notification-prefs', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { prefs?: { browser_push?: boolean | null } }) => {
        setBrowserPush(Boolean(j.prefs?.browser_push));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleEnable() {
    if (typeof Notification === 'undefined') return;
    setSaving(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        const res = await fetch('/api/messenger/notification-prefs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ browserPush: true }),
        });
        if (res.ok) {
          setBrowserPush(true);
          try {
            window.dispatchEvent(new CustomEvent('messenger:prefs-updated', { detail: { browser_push: true } }));
          } catch { /* non-fatal */ }
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    setSaving(true);
    try {
      const res = await fetch('/api/messenger/notification-prefs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ browserPush: false }),
      });
      if (res.ok) {
        setBrowserPush(false);
        try {
          window.dispatchEvent(new CustomEvent('messenger:prefs-updated', { detail: { browser_push: false } }));
        } catch { /* non-fatal */ }
      }
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Loading...</p>;
  }

  if (permission === 'unsupported') {
    return <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Push Notifications Are Not Supported In This Browser.</p>;
  }

  if (permission === 'denied') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', marginTop: 4, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--white)', margin: '0 0 4px', fontWeight: 600 }}>Push Notifications Blocked</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>
            Your Browser Has Blocked Notifications For This Site. To Enable Them, Go To Your Browser Settings And Allow Notifications For This Domain.
          </p>
        </div>
      </div>
    );
  }

  const isEnabled = permission === 'granted' && browserPush === true;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: isEnabled ? 'var(--teal)' : 'var(--grey-500)',
        }} />
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--white)', margin: '0 0 2px', fontWeight: 600 }}>
            {isEnabled ? 'Push Notifications Enabled' : 'Push Notifications Disabled'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)', margin: 0 }}>
            {isEnabled ? 'You Will Receive Alerts When A New Message Arrives.' : 'Enable To Get Alerts When The Tab Is Hidden.'}
          </p>
        </div>
      </div>
      {isEnabled ? (
        <button
          type="button"
          onClick={handleDisable}
          disabled={saving}
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0, minWidth: 90 }}
        >
          {saving ? 'Saving...' : 'Disable'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleEnable}
          disabled={saving}
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0, minWidth: 90 }}
        >
          {saving ? 'Saving...' : 'Enable'}
        </button>
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

/* ─────────────────────────────────────────────────────
   ThemeToggleCard — Dark / Light mode toggle in Settings
   ───────────────────────────────────────────────────── */
function ThemeToggleCard() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
      <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Display Theme</h4>
      <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)', marginTop: 0 }}>
        Switch Between Dark Mode And Light Mode. Your Preference Is Saved Automatically.
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-4)',
        background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(192,184,168,0.2)',
      }}>
        {/* Icon + Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: isLight
              ? 'linear-gradient(135deg, #FFF4D6 0%, #FFE082 100%)'
              : 'linear-gradient(135deg, #1A2A3A 0%, #2A3A4A 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isLight ? '0 0 12px rgba(255,193,7,0.4)' : '0 0 12px rgba(192,184,168,0.2)',
            transition: 'all 0.3s ease',
          }}>
            {isLight ? (
              /* Sun icon */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              /* Moon icon */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--white)' }}>
              {isLight ? 'Light Mode' : 'Dark Mode'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginTop: 2 }}>
              {isLight ? 'Warm Off-White Theme' : 'Premium Dark Theme'}
            </div>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={toggleTheme}
          aria-label={isLight ? 'Switch To Dark Mode' : 'Switch To Light Mode'}
          style={{
            width: 52,
            height: 28,
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: isLight
              ? 'linear-gradient(135deg, #F59E0B, #FCD34D)'
              : 'linear-gradient(135deg, var(--teal-dark), var(--teal))',
            position: 'relative',
            transition: 'background 0.3s ease',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 3,
            left: isLight ? 'calc(100% - 25px)' : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'left 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </button>
      </div>
    </div>
  );
}
