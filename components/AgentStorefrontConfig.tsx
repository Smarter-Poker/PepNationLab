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

      // Only PATCH the Shippo key if the user actually typed one (avoids
      // wiping the stored key when the field is empty / hidden).
      if (showShippoKey && shippoApiKey.trim()) {
        updatePayload.shippo_api_key = shippoApiKey.trim();
      }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: '0.78rem', color: vacationToggle ? 'var(--teal)' : 'var(--grey-400)' }}>
              {vacationToggle ? 'Open For Business' : 'Vacation Mode'}
            </span>
            <button
              type="button"
              onClick={() => handleVacationToggle(!vacationToggle)}
              aria-label="Toggle Vacation Mode"
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: vacationToggle ? 'var(--teal)' : 'var(--surface-3)',
                border: '1px solid rgba(255,255,255,0.1)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: vacationToggle ? 22 : 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--black)',
                  transition: 'left 0.2s',
                }}
              />
            </button>
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
              <label className="form-label">Logo URL</label>
              <input type="url" className="form-input" placeholder="https://..." value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
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

          <h4 style={{ color: 'var(--teal)', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>Automated Shipping Integration (Optional)</h4>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
            Connect Your Own Shippo Account To Instantly Purchase And Print USPS/UPS Shipping Labels From The Orders Dashboard.
          </p>

          <div className="form-group">
            <label className="form-label">Shippo API Token (Live Token)</label>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <input
                type={showShippoKey ? 'text' : 'password'}
                placeholder={shippoKeyPresent ? `Token On File (...${shippoKeyLast4 ?? ''})` : 'shippo_live_...'}
                className="form-input"
                value={shippoApiKey}
                onChange={(e) => setShippoApiKey(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleRevealShippoKey}
                className="btn btn-secondary btn-sm"
                disabled={loadingKey}
              >
                {loadingKey ? 'Loading...' : showShippoKey ? 'Hide Key' : 'Show Key'}
              </button>
            </div>
            {shippoKeyPresent && !showShippoKey && (
              <p style={{ fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: 4 }}>
                A Token Is Already On File (Ending In {shippoKeyLast4}). Leave Blank To Keep It.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
