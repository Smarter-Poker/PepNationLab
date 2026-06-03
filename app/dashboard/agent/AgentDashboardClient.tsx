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
import AgentDownline from '@/components/AgentDownline';
import AgentInbox from '@/components/AgentInbox';
import AgentOverview from '@/components/AgentOverview';
import AgentStorefrontConfig from '@/components/AgentStorefrontConfig';
import AgentOrders from '@/components/AgentOrders';
import AgentBundles from '@/components/AgentBundles';
import AgentResearcherCRMv2 from '@/components/AgentResearcherCRMv2';
import AgentNetworkMap from '@/components/AgentNetworkMap';
import AgentSetupChecklist from '@/components/AgentSetupChecklist';
import MessageBell from '@/components/MessageBell';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import { sanitizeUsername } from '@/lib/usernames';
import { useTheme } from '@/components/ThemeProvider';
import PaymentMethodsPanel from '@/components/PaymentMethodsPanel';
import AvatarUpload from '@/components/AvatarUpload';
import { createPortal } from 'react-dom';
import MyQRCodeModal from '@/components/MyQRCodeModal';
import { useAvailability, availabilityMessage } from '@/lib/useAvailability';


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
  last_sign_in_at?: string | null;
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
  const [showQRModal, setShowQRModal] = useState(false);


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

  // Whitelist of valid tabs. Any unknown / malformed ?tab= value (e.g. a link
  // whose "&" terminated the query string, leaving "Sales ") must fall back to
  // the default tab — otherwise the main panel renders blank and looks broken.
  const VALID_TABS = ['Overview', 'Sales & Accounting', 'Orders', 'Researchers', 'My Sub-Agents', 'My Agent Accounts', 'Store Products', 'Research Bundles', 'Inventory', 'Coupons', 'Storefront Config', 'Settings'] as const;
  type AgentTabName = typeof VALID_TABS[number];
  const resolveTab = (t: unknown): AgentTabName =>
    (typeof t === 'string' && (VALID_TABS as readonly string[]).includes(t)) ? (t as AgentTabName) : (defaultTab as AgentTabName);

  const [activeTab, setActiveTabState] = useState<AgentTabName>(resolveTab(tabParam));

  const setActiveTab = (tab: typeof activeTab) => {
    setActiveTabState(tab);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('tab', tab);
    router.push(`?${newParams.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const newTab = resolveTab(tabParam);
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
  // removed isMobileMenuOpen

  // Create Researcher Modal State
  const [showCreateResearcher, setShowCreateResearcher] = useState(false);
  // R31: split first/last so the Create Researcher form mirrors every other
  // create-account form on the platform. /api/agent/create-researcher already
  // accepts firstName + lastName directly.
  const [crFirstName, setCrFirstName] = useState('');
  const [crLastName, setCrLastName] = useState('');
  const [crUsername, setCrUsername] = useState('');
  const [crPassword, setCrPassword] = useState('');
  // R36: live username availability check for the Create Researcher modal.
  // Mirrors the pattern used by the public storefront register form.
  const crUsernameCheck = useAvailability({ field: 'username', value: crUsername, minLength: 2 });
  const crUsernameMsg = availabilityMessage(crUsernameCheck);
  const crUsernameBlocked =
    crUsernameCheck.status === 'taken' ||
    crUsernameCheck.status === 'reserved' ||
    crUsernameCheck.status === 'invalid';
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
  const [promoteCommission, setPromoteCommission] = useState('20');
  const [promotePaymentModel, setPromotePaymentModel] = useState<'credit'|'prepaid'>('prepaid');
  const [promoteCreditLimit, setPromoteCreditLimit] = useState('0');
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
      const firstName = crFirstName.trim();
      const lastName = crLastName.trim();

      const res = await fetch('/api/agent/create-researcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, username: crUsername, password: crPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCrError(json.error || 'Failed To Create Researcher Account');
      } else {
        setCrSuccess(`Researcher Account Created — Username: ${json.username}`);
        setResearcherList(prev => [...prev, {
          id: json.userId,
          email: `${json.username}@internal.auth`,
          username: json.username,
          full_name: json.full_name,
          created_at: new Date().toISOString(),
        }]);
        setCrFirstName(''); setCrLastName('');
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
        body: JSON.stringify({ 
          researcherId: promoteResearcher.id,
          commissionPct: promoteCommission,
          paymentModel: promotePaymentModel,
          creditLimit: promoteCreditLimit
        })
      });
      if (!resApi.ok) {
        const errData = await resApi.json();
        throw new Error(errData.error || 'Failed to promote');
      }
      toast.success(`Researcher successfully promoted to ${userProfile.is_super_agent ? 'Agent' : 'Sub-Agent'}!`);
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

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      {/* Mobile Top Navbar (Global) */}
      <Navbar title={initialAgentProfile?.display_name || userProfile.full_name || 'AGENT DASHBOARD'} />

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .hide-on-mobile { display: none !important; }
        }
      `}} />

      <div className="dashboard-main" style={{ minHeight: '100dvh' }}>
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


        {/* My Sub-Agents Tab */}
        {activeTab === 'My Sub-Agents' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentSubAgents agentId={userProfile.id} />
          </div>
        )}

        {/* My Agent Accounts Tab */}
        {activeTab === 'My Agent Accounts' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentDownline agentId={userProfile.id} />
            <AgentNetworkMap />
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

        {activeTab === 'Sales & Accounting' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentSales orders={orders} setOrders={setOrders} agentId={userProfile.id} userProfile={userProfile} />
          </div>
        )}

        {/* TAB: Orders & Fulfillment */}
        {activeTab === 'Orders' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <AgentOrders orders={orders} setOrders={setOrders} />
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
                          {userProfile.is_super_agent ? 'Promote To Agent' : 'Promote To Sub-Agent'}
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
                        Close
                      </button>
                    </div>

                    <p style={{ color: '#d0d8e4', fontSize: '0.95rem', marginBottom: 20, lineHeight: 1.5 }}>
                      {userProfile.is_super_agent ? 'Promote This Researcher To An Agent?' : 'Promote This Researcher To A Sub-Agent? They Will Be Able To Set Prices For Their Own Downline.'}
                    </p>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label" style={{ color: '#8a9ab0', fontSize: '0.8rem', fontWeight: 600 }}>Commission Percentage (% Of Total Sales)</label>
                      <input type="number" className="form-input" min="0" max="40" value={promoteCommission} onChange={e => setPromoteCommission(e.target.value)} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label" style={{ color: '#8a9ab0', fontSize: '0.8rem', fontWeight: 600 }}>Account Type</label>
                      <select className="form-input" value={promotePaymentModel} onChange={e => setPromotePaymentModel(e.target.value as any)}>
                        <option value="prepaid">Prepaid (Wallet)</option>
                        <option value="credit">Credit Line</option>
                      </select>
                    </div>

                    {promotePaymentModel === 'credit' && (
                      <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label" style={{ color: '#8a9ab0', fontSize: '0.8rem', fontWeight: 600 }}>Credit Limit ($)</label>
                        <input type="number" className="form-input" min="0" value={promoteCreditLimit} onChange={e => setPromoteCreditLimit(e.target.value)} />
                      </div>
                    )}

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
                        {promoteLoading ? 'Promoting...' : (userProfile.is_super_agent ? 'Promote To Agent' : 'Promote To Sub-Agent')}
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
                  className="glass-panel stagger-fade-in"
                  style={{
                    maxWidth: 480, width: '100%',
                    padding: '28px 28px 24px',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {/* Inner container */}
                  <div>

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
                        Close
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

                      {/* R31: First + Last Name — top-aligned grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18, alignItems: 'start' }}>
                        <div>
                          <label style={{
                            display: 'block', fontSize: '0.92rem', fontWeight: 700,
                            color: '#d0d8e4', marginBottom: 8,
                          }}>First Name</label>
                          <input
                            type="text"
                            value={crFirstName}
                            onChange={e => setCrFirstName(e.target.value)}
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
                        <div>
                          <label style={{
                            display: 'block', fontSize: '0.92rem', fontWeight: 700,
                            color: '#d0d8e4', marginBottom: 8,
                          }}>Last Name</label>
                          <input
                            type="text"
                            value={crLastName}
                            onChange={e => setCrLastName(e.target.value)}
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
                          aria-invalid={crUsernameBlocked || undefined}
                          aria-describedby="cr-username-status"
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'linear-gradient(180deg, #0a0c14 0%, #0d1018 100%)',
                            border: '1px solid ' + (
                              crUsernameCheck.status === 'available' ? '#34D399'
                              : crUsernameBlocked ? '#FC8181'
                              : '#2a3045'
                            ),
                            borderRadius: 8,
                            padding: '13px 14px',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            outline: 'none',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7), inset 0 1px 3px rgba(0,0,0,0.5)',
                            caretColor: '#00C4BC',
                          }}
                          onFocus={e => {
                            if (crUsernameCheck.status !== 'available' && !crUsernameBlocked) {
                              e.currentTarget.style.border = '1px solid #00C4BC';
                            }
                          }}
                          onBlur={e => {
                            if (crUsernameCheck.status === 'available') e.currentTarget.style.border = '1px solid #34D399';
                            else if (crUsernameBlocked) e.currentTarget.style.border = '1px solid #FC8181';
                            else e.currentTarget.style.border = '1px solid #2a3045';
                          }}
                        />
                        {/* Live availability status row — green/red/amber/silver */}
                        {crUsernameMsg && (
                          <div
                            id="cr-username-status"
                            role="status"
                            aria-live="polite"
                            style={{
                              marginTop: 6,
                              fontSize: '0.78rem',
                              color: crUsernameMsg.color,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              lineHeight: 1.3,
                            }}
                          >
                            {crUsernameMsg.tone === 'success' && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={crUsernameMsg.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                            {crUsernameMsg.tone === 'error' && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={crUsernameMsg.color} strokeWidth="3" strokeLinecap="round" aria-hidden>
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            )}
                            {crUsernameMsg.tone === 'warn' && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={crUsernameMsg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <circle cx="12" cy="17" r="0.5" />
                              </svg>
                            )}
                            {crUsernameMsg.tone === 'info' && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={crUsernameMsg.color} strokeWidth="2" strokeLinecap="round" aria-hidden>
                                <circle cx="12" cy="12" r="9" />
                                <line x1="12" y1="7" x2="12" y2="13" />
                                <circle cx="12" cy="17" r="0.5" />
                              </svg>
                            )}
                            <span>{crUsernameMsg.text}</span>
                          </div>
                        )}
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

                      {/* Submit button at the bottom */}
                      <button
                        type="submit"
                        disabled={crLoading || crUsernameBlocked || crUsernameCheck.status === 'checking'}
                        style={{
                          width: '100%',
                          marginTop: 8,
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
                        {crLoading ? 'Creating Account...' : (crUsernameBlocked ? 'Pick A Different Username' : (crUsernameCheck.status === 'checking' ? 'Checking Username…' : 'Create Researcher Account'))}
                      </button>

                    </form>
                  </div>
                </div>
              </div>
            )}


            {/* My Researchers — premium header with action + full CRM below */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Action header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12,
                padding: '20px 24px', borderRadius: 16,
                background: 'linear-gradient(160deg, rgba(20,28,44,0.98) 0%, rgba(13,19,30,0.98) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.30)',
              }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em', margin: 0 }}>My Researchers</h3>
                  <p style={{ fontSize: '0.78rem', color: '#6A7A8A', margin: '4px 0 0' }}>Your full researcher team — manage, message, and track from here</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {researcherList.length > 0 && (
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, color: '#00C4BC',
                      background: 'rgba(0,196,188,0.10)', border: '1px solid rgba(0,196,188,0.30)',
                      borderRadius: 999, padding: '4px 12px',
                    }}>
                      {researcherList.length} Researcher{researcherList.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {researcherList.some(r => r.last_sign_in_at === null) && (
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, color: '#F59E0B',
                      background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)',
                      borderRadius: 999, padding: '4px 12px',
                    }}>
                      {researcherList.filter(r => !r.last_sign_in_at).length} Never Logged In
                    </span>
                  )}
                  {userProfile.is_super_agent && researcherList.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {researcherList.map(res => (
                        <button
                          key={res.id}
                          onClick={() => setResetPwUser({ id: res.id, name: res.full_name || 'Researcher', username: res.username ?? res.email.split('@')[0] })}
                          style={{ fontSize: '0.68rem', color: '#8A9BB0', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textDecoration: 'underline', textAlign: 'left' }}
                        >
                          Reset @{res.username ?? res.email.split('@')[0]} password
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => { setShowCreateResearcher(true); setCrError(''); setCrSuccess(''); }}
                    style={{
                      padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: '0.84rem',
                      background: 'linear-gradient(135deg, #00C4BC 0%, #00a89f 100%)',
                      border: 'none', color: '#FFFFFF', cursor: 'pointer',
                      boxShadow: '0 2px 12px rgba(0,196,188,0.30)',
                      transition: 'opacity 0.15s, transform 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    + Create Researcher Account
                  </button>
                </div>
              </div>

              {/* Full CRM */}
              <AgentResearcherCRMv2
                isSuperAgent={userProfile.is_super_agent}
                onResetPassword={setResetPwUser}
                onPromote={setPromoteResearcher}
                onToggleAutoApprove={handleToggleTrust}
              />
            </div>
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




      </div>
      </div>

      {/* Reset Password Modal (for researchers & sub-agents) */}
      {resetPwUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel stagger-fade-in" style={{ width: '100%', maxWidth: 400, padding: 'var(--space-6)', position: 'relative' }}>
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

      <MyQRCodeModal open={showQRModal} onClose={() => setShowQRModal(false)} />
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
