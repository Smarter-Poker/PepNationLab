'use client';

import React from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface AgentStorefrontConfigProps {
  displayName: string;
  setDisplayName: (val: string) => void;
  slug: string;
  setSlug: (val: string) => void;
  logoUrl: string;
  setLogoUrl: (val: string) => void;
  tagline: string;
  setTagline: (val: string) => void;
  bio: string;
  setBio: (val: string) => void;
  primaryColor: string;
  setPrimaryColor: (val: string) => void;
  zelleHandle: string;
  setZelleHandle: (val: string) => void;
  cashappHandle: string;
  setCashappHandle: (val: string) => void;
  venmoHandle: string;
  setVenmoHandle: (val: string) => void;
  applePayHandle: string;
  setApplePayHandle: (val: string) => void;
  // Shippo key handling: the parent now passes empty string (raw key is
  // redacted server-side). The component fetches the real key on demand
  // when the user clicks "Show Key".
  shippoApiKey: string;
  setShippoApiKey: (val: string) => void;
  shippoKeyPresent?: boolean;
  shippoKeyLast4?: string | null;
  // Warehouse address (JSONB) — read/write directly to agent_profiles.
  warehouseAddress?: Record<string, any> | null;
  // Vacation mode — flips agent_profiles.is_active.
  isActive?: boolean | null;
  // Volume (tiered) pricing — on by default, agents can disable.
  volumePricingEnabled: boolean;
  setVolumePricingEnabled: (val: boolean) => void;
  agentId: string;
}

export default function AgentStorefrontConfig({
  displayName, setDisplayName,
  slug, setSlug,
  logoUrl, setLogoUrl,
  tagline, setTagline,
  bio, setBio,
  primaryColor, setPrimaryColor,
  zelleHandle, setZelleHandle,
  cashappHandle, setCashappHandle,
  venmoHandle, setVenmoHandle,
  applePayHandle, setApplePayHandle,
  shippoApiKey, setShippoApiKey,
  shippoKeyPresent = false,
  shippoKeyLast4 = null,
  warehouseAddress,
  isActive,
  volumePricingEnabled,
  setVolumePricingEnabled,
  agentId,
}: AgentStorefrontConfigProps) {
  const [loading, setLoading] = React.useState(false);
  const [showShippoKey, setShowShippoKey] = React.useState(false);
  const [loadingKey, setLoadingKey] = React.useState(false);

  // Warehouse address local state — mirrors agent_profiles.warehouse_address.
  const [whName, setWhName] = React.useState(warehouseAddress?.name ?? '');
  const [whStreet1, setWhStreet1] = React.useState(warehouseAddress?.street1 ?? '');
  const [whStreet2, setWhStreet2] = React.useState(warehouseAddress?.street2 ?? '');
  const [whCity, setWhCity] = React.useState(warehouseAddress?.city ?? '');
  const [whState, setWhState] = React.useState(warehouseAddress?.state ?? '');
  const [whZip, setWhZip] = React.useState(warehouseAddress?.zip ?? '');

  // Vacation mode (is_active): true = open, false = paused.
  const [vacationToggle, setVacationToggle] = React.useState<boolean>(isActive !== false);

  async function handleRevealShippoKey() {
    if (showShippoKey) {
      // Toggle off — wipe the in-memory key.
      setShowShippoKey(false);
      setShippoApiKey('');
      return;
    }
    setLoadingKey(true);
    try {
      const res = await fetch('/api/agent/storefront-config/shippo-key', { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed To Load Key');
      setShippoApiKey(data.shippo_api_key || '');
      setShowShippoKey(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed To Reveal Shippo Key');
    } finally {
      setLoadingKey(false);
    }
  }

  async function handleVacationToggle(next: boolean) {
    setVacationToggle(next);
    const supabase = createClient();
    const { error } = await supabase
      .from('agent_profiles')
      .update({ is_active: next })
      .eq('id', agentId);
    if (error) {
      // Roll back UI on failure.
      setVacationToggle(!next);
      toast.error('Failed To Update Storefront Status');
    } else {
      toast.success(next ? 'Storefront Is Now Open' : 'Storefront Paused');
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();

    if (!/^[a-z0-9\-]+$/.test(cleanSlug)) {
      toast.error('Slug Must Contain Only Lowercase Letters, Numbers, And Hyphens.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // 1) Slug update goes through the server endpoint so it can enforce
      //    the DB UNIQUE + reserved-word CHECK with a clean 409 surface.
      const slugRes = await fetch('/api/agent/storefront-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: cleanSlug }),
      });
      const slugJson = await slugRes.json().catch(() => ({}));
      if (!slugRes.ok) {
        if (slugRes.status === 409) {
          throw new Error(slugJson?.error || 'Slug Is Reserved Or Already In Use');
        }
        throw new Error(slugJson?.error || 'Failed To Update Slug');
      }

      // 2) Everything else updates inline (RLS allows the owner to update
      //    their own agent_profiles row).
      const updatePayload: Record<string, any> = {
        display_name: displayName.trim(),
        logo_url: logoUrl.trim() || null,
        tagline: tagline.trim() || null,
        bio: bio.trim() || null,
        primary_color: primaryColor,
        volume_pricing_enabled: volumePricingEnabled,
        payment_handles: {
          zelle: zelleHandle.trim(),
          cashapp: cashappHandle.trim(),
          venmo: venmoHandle.trim(),
          apple_pay: applePayHandle.trim(),
        },
        warehouse_address: {
          name: whName.trim(),
          street1: whStreet1.trim(),
          street2: whStreet2.trim() || null,
          city: whCity.trim(),
          state: whState.trim(),
          zip: whZip.trim(),
        },
      };

      // Per-agent Shippo key write intentionally removed post-M1.
      // All labels are purchased through the platform Shippo account.
      // shippo_api_key on agent_profiles is deprecated and ignored.

      const { error: updateError } = await supabase
        .from('agent_profiles')
        .update(updatePayload)
        .eq('id', agentId);

      if (updateError) {
        throw new Error(updateError.message);
      }
      toast.success('Storefront Configuration Updated Successfully');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed To Update Storefront Configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="card-metal" style={{ padding: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Storefront Setup</h3>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem' }}>
              Configure Your Public-Facing White-Label Storefront.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>

            {/* Volume Pricing Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.78rem', color: volumePricingEnabled ? '#C0B8A8' : 'var(--grey-400)', display: 'block', lineHeight: 1.2 }}>
                  {volumePricingEnabled ? 'Volume Pricing On' : 'Volume Pricing Off'}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--grey-500)' }}>
                  {volumePricingEnabled ? 'Tiers active' : 'Flat per-vial price'}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const next = !volumePricingEnabled;
                  setVolumePricingEnabled(next);
                  const supabase = createClient();
                  const { error } = await supabase
                    .from('agent_profiles')
                    .update({ volume_pricing_enabled: next })
                    .eq('id', agentId);
                  if (error) {
                    setVolumePricingEnabled(!next);
                    const { toast } = await import('sonner');
                    toast.error('Failed to update volume pricing setting');
                  } else {
                    const { toast } = await import('sonner');
                    toast.success(next ? 'Volume pricing enabled' : 'Volume pricing disabled');
                  }
                }}
                aria-label="Toggle Volume Pricing"
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: volumePricingEnabled ? '#C0B8A8' : 'var(--surface-3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2,
                  left: volumePricingEnabled ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--black)', transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />

            {/* Vacation Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '0.78rem', color: vacationToggle ? 'var(--teal)' : 'var(--grey-400)' }}>
                {vacationToggle ? 'Open For Business' : 'Vacation Mode'}
              </span>
              <button
                type="button"
                onClick={() => handleVacationToggle(!vacationToggle)}
                aria-label="Toggle Vacation Mode"
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: vacationToggle ? 'var(--teal)' : 'var(--surface-3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2,
                  left: vacationToggle ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--black)', transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input type="text" className="form-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">URL Slug</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', paddingLeft: 'var(--space-3)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>pepnationlab.com/</span>
                <input type="text" className="form-input" value={slug} onChange={(e) => setSlug(e.target.value)} style={{ background: 'transparent', border: 'none', boxShadow: 'none' }} required />
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Store Logo</label>
              {logoUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Logo" style={{ height: 48, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLogoUrl('')} style={{ fontSize: '0.75rem' }}>Remove</button>
                </div>
              ) : null}
              <label
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-3)', border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', fontSize: '0.85rem', color: 'var(--silver)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-3)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {logoUrl ? 'Replace Logo' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const supabase = createClient();
                    const ext = file.name.split('.').pop() || 'png';
                    const path = `agent-logos/${agentId}-${Date.now()}.${ext}`;
                    const { error: uploadError } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true });
                    if (uploadError) {
                      toast.error('Failed to upload logo: ' + uploadError.message);
                      return;
                    }
                    const { data: pub } = supabase.storage.from('public-assets').getPublicUrl(path);
                    if (pub?.publicUrl) {
                      setLogoUrl(pub.publicUrl);
                      toast.success('Logo uploaded! Click Save to apply.');
                    }
                  }}
                />
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Primary Brand Color</label>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: 48, height: 44, padding: 0, border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'transparent' }} />
                <input type="text" className="form-input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} pattern="^#+([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$" />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tagline (Hero Subtitle)</label>
            <input type="text" className="form-input" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">About Us / Bio (Footer)</label>
            <textarea className="form-input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: 'var(--space-4) 0' }} />

          <h4 style={{ color: 'var(--teal)', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>Offline Payment Instructions</h4>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
            These Details Will Be Shown To Your Customers After They Complete Their Order, Instructing Them Where To Send Funds.
          </p>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Zelle Handle / Email</label>
              <input type="text" className="form-input" value={zelleHandle} onChange={(e) => setZelleHandle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Cash App Handle ($)</label>
              <input type="text" className="form-input" value={cashappHandle} onChange={(e) => setCashappHandle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Venmo Handle (@)</label>
              <input type="text" className="form-input" value={venmoHandle} onChange={(e) => setVenmoHandle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Apple Pay (Phone / Email)</label>
              <input type="text" className="form-input" value={applePayHandle} onChange={(e) => setApplePayHandle(e.target.value)} />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: 'var(--space-4) 0' }} />

          <h4 style={{ color: 'var(--teal)', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>Warehouse Address</h4>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
            Used As The Ship-From Address When Buying Shipping Labels.
          </p>

          <div className="form-group">
            <label className="form-label">Warehouse Contact Name</label>
            <input type="text" className="form-input" value={whName} onChange={(e) => setWhName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Street Address Line 1</label>
            <input type="text" className="form-input" value={whStreet1} onChange={(e) => setWhStreet1(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Street Address Line 2 (Optional)</label>
            <input type="text" className="form-input" value={whStreet2} onChange={(e) => setWhStreet2(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div className="form-group">
              <label className="form-label">City</label>
              <input type="text" className="form-input" value={whCity} onChange={(e) => setWhCity(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input type="text" className="form-input" maxLength={2} value={whState} onChange={(e) => setWhState(e.target.value.toUpperCase())} />
            </div>
            <div className="form-group">
              <label className="form-label">Zip</label>
              <input type="text" className="form-input" maxLength={10} value={whZip} onChange={(e) => setWhZip(e.target.value)} />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: 'var(--space-4) 0' }} />

          <h4 style={{ color: 'var(--teal)', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>Shipping Integration</h4>
          <div style={{
            background: 'rgba(0,196,188,0.06)',
            border: '1px solid rgba(0,196,188,0.2)',
            borderRadius: 8,
            padding: 'var(--space-4)',
          }}>
            <p style={{ color: 'var(--silver)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
              Shipping Labels Are Purchased Through The PepNationLab Platform Account.
              No Per-Agent Shippo Key Required.
              To Set Your Warehouse Ship-From Address, Contact Your Admin To Assign A Shipping Origin
              In Settings &rarr; Shipping &rarr; Agent Warehouses.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Pricing & Discounts Configuration ── */}
      <PricingConfig agentId={agentId} />
    </div>
  );
}

/* ─── Pricing Config Sub-Component ─── */
function PricingConfig({ agentId }: { agentId: string }) {
  const supabase = createClient();
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Dynamic pricing (small-order surcharges)
  const [enableDynamic, setEnableDynamic] = React.useState(true);
  const [minOrderQty, setMinOrderQty] = React.useState(1);
  const [dynamicTiers, setDynamicTiers] = React.useState([
    { min_qty: 1, max_qty: 2, surcharge_percent: 20 },
    { min_qty: 3, max_qty: 5, surcharge_percent: 15 },
    { min_qty: 6, max_qty: 9, surcharge_percent: 10 },
    { min_qty: 10, max_qty: 999999, surcharge_percent: 0 },
  ]);

  // Bulk volume discounts
  const [enableBulk, setEnableBulk] = React.useState(false);
  const [bulkTiers, setBulkTiers] = React.useState([
    { min_qty: 100, discount_percent: 5 },
    { min_qty: 300, discount_percent: 10 },
    { min_qty: 500, discount_percent: 15 },
  ]);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('agent_profiles')
        .select('enable_dynamic_pricing, dynamic_pricing_tiers, min_order_qty, enable_bulk_discounts, bulk_discount_tiers')
        .eq('id', agentId)
        .single();
      if (data) {
        if (data.enable_dynamic_pricing != null) setEnableDynamic(data.enable_dynamic_pricing);
        if (data.dynamic_pricing_tiers) setDynamicTiers(data.dynamic_pricing_tiers as any);
        if (data.min_order_qty != null) setMinOrderQty(data.min_order_qty);
        if (data.enable_bulk_discounts != null) setEnableBulk(data.enable_bulk_discounts);
        if (data.bulk_discount_tiers) setBulkTiers(data.bulk_discount_tiers as any);
      }
      setLoaded(true);
    })();
  }, [agentId]);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('agent_profiles')
      .update({
        enable_dynamic_pricing: enableDynamic,
        dynamic_pricing_tiers: dynamicTiers,
        min_order_qty: minOrderQty,
        enable_bulk_discounts: enableBulk,
        bulk_discount_tiers: bulkTiers,
      })
      .eq('id', agentId);
    setSaving(false);
    if (error) toast.error('Failed To Save Pricing Config');
    else toast.success('Pricing Configuration Saved');
  }

  if (!loaded) return <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>Loading Pricing Config...</div>;

  const toggleStyle = (on: boolean): React.CSSProperties => ({
    width: 44, height: 24, borderRadius: 12, background: on ? 'var(--teal)' : 'var(--surface-3)',
    border: '1px solid rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
  });
  const toggleDot = (on: boolean): React.CSSProperties => ({
    position: 'absolute', top: 2, left: on ? 22 : 2, width: 18, height: 18, borderRadius: '50%',
    background: 'var(--black)', transition: 'left 0.2s',
  });

  return (
    <div className="card-metal" style={{ padding: 'var(--space-8)', marginTop: 'var(--space-6)' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Pricing & Discounts</h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginBottom: 'var(--space-6)' }}>
        Configure quantity-based pricing and bulk volume discounts for your storefront.
      </p>

      {/* Dynamic Pricing Section */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h4 style={{ color: 'var(--teal)', fontSize: '1rem', marginBottom: 2 }}>Dynamic Pricing</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>Small-order surcharges for orders under 10 vials</p>
          </div>
          <button type="button" onClick={() => setEnableDynamic(!enableDynamic)} style={toggleStyle(enableDynamic)}>
            <span style={toggleDot(enableDynamic)} />
          </button>
        </div>

        {enableDynamic && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Minimum Order Qty:</span>
              <input type="number" min={1} className="form-input" style={{ width: 70, padding: '4px 8px', height: 32 }}
                value={minOrderQty} onChange={e => setMinOrderQty(Number(e.target.value) || 1)} />
            </div>
            {dynamicTiers.map((tier, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--grey-400)', minWidth: 60 }}>{tier.min_qty}-{tier.max_qty === 999999 ? '∞' : tier.max_qty} vials</span>
                <span style={{ color: 'var(--grey-400)' }}>+</span>
                <input type="number" min={0} max={100} className="form-input" style={{ width: 60, padding: '4px 8px', height: 32 }}
                  value={tier.surcharge_percent} onChange={e => {
                    const next = [...dynamicTiers]; next[i] = { ...next[i], surcharge_percent: Number(e.target.value) || 0 }; setDynamicTiers(next);
                  }} />
                <span style={{ color: 'var(--grey-400)' }}>% surcharge</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: 'var(--space-4) 0' }} />

      {/* Bulk Discounts Section */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h4 style={{ color: 'var(--teal)', fontSize: '1rem', marginBottom: 2 }}>Bulk Volume Discounts</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>Offer discounts for large quantity orders (100+ vials)</p>
          </div>
          <button type="button" onClick={() => setEnableBulk(!enableBulk)} style={toggleStyle(enableBulk)}>
            <span style={toggleDot(enableBulk)} />
          </button>
        </div>

        {enableBulk && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {bulkTiers.map((tier, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '0.85rem' }}>
                <input type="number" min={1} className="form-input" style={{ width: 80, padding: '4px 8px', height: 32 }}
                  value={tier.min_qty} onChange={e => {
                    const next = [...bulkTiers]; next[i] = { ...next[i], min_qty: Number(e.target.value) || 1 }; setBulkTiers(next);
                  }} />
                <span style={{ color: 'var(--grey-400)' }}>+ vials =</span>
                <input type="number" min={0} max={100} className="form-input" style={{ width: 60, padding: '4px 8px', height: 32 }}
                  value={tier.discount_percent} onChange={e => {
                    const next = [...bulkTiers]; next[i] = { ...next[i], discount_percent: Number(e.target.value) || 0 }; setBulkTiers(next);
                  }} />
                <span style={{ color: 'var(--grey-400)' }}>% off</span>
                <button type="button" onClick={() => setBulkTiers(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.8rem' }}>Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => setBulkTiers(prev => [...prev, { min_qty: 100, discount_percent: 5 }])}
              className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', fontSize: '0.78rem' }}>
              + Add Tier
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={handleSave} className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Pricing Config'}
        </button>
      </div>
    </div>
  );
}
