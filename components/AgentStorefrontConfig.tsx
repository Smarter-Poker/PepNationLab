'use client';

import React from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import UniqueField from '@/components/UniqueField';

interface AgentStorefrontConfigProps {
  displayName: string;
  setDisplayName: (val: string) => void;
  slug: string;
  setSlug: (val: string) => void;
  logoUrl: string;
  setLogoUrl: (val: string) => void;
  // Warehouse address (JSONB) - read/write directly to agent_profiles.
  warehouseAddress?: Record<string, any> | null;
  agentId: string;
  displayNameChangedAt?: string | null;
  onSaveSuccess?: (updatedData: any) => void;
  paymentMethodsNode?: React.ReactNode;
}

/** Derive a slug-shaped suggestion from a free-form display name. */
function deriveSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

export default function AgentStorefrontConfig({
  displayName, setDisplayName,
  slug, setSlug,
  logoUrl, setLogoUrl,
  warehouseAddress,
  agentId,
  displayNameChangedAt,
  onSaveSuccess,
  paymentMethodsNode,
}: AgentStorefrontConfigProps) {
  const [loading, setLoading] = React.useState(false);

  // Reservation tokens issued by the live availability check. Sent on save.
  const [slugReservationToken, setSlugReservationToken] = React.useState<string | null>(null);
  const [displayNameReservationToken, setDisplayNameReservationToken] = React.useState<string | null>(null);

  // One-shot slug auto-suggestion. Triggers only when slug is empty and the
  // user starts typing a display name - once accepted (or once they touch
  // the slug field), we never overwrite again.
  const slugWasAutoFilledRef = React.useRef(false);
  React.useEffect(() => {
    const derived = deriveSlugFromName(displayName);
    if (!slug && !slugWasAutoFilledRef.current && derived && derived.length >= 3) {
      slugWasAutoFilledRef.current = true;
      setSlug(derived);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName]);

  // Warehouse address local state - mirrors agent_profiles.warehouse_address.
  const [whName, setWhName] = React.useState(warehouseAddress?.name ?? '');
  const [whStreet1, setWhStreet1] = React.useState(warehouseAddress?.street1 ?? '');
  const [whStreet2, setWhStreet2] = React.useState(warehouseAddress?.street2 ?? '');
  const [whCity, setWhCity] = React.useState(warehouseAddress?.city ?? '');
  const [whState, setWhState] = React.useState(warehouseAddress?.state ?? '');
  const [whZip, setWhZip] = React.useState(warehouseAddress?.zip ?? '');

  // Check if User Name is in 6-month cooldown
  const canChangeDisplayName = React.useMemo(() => {
    if (!displayNameChangedAt) return true;
    const lastChange = new Date(displayNameChangedAt).getTime();
    const COOLDOWN_MS = 180 * 24 * 60 * 60 * 1000;
    return Date.now() - lastChange >= COOLDOWN_MS;
  }, [displayNameChangedAt]);

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
      //    the DB UNIQUE + reserved-word CHECK with a clean 409 surface,
      //    and now also consume the soft reservation token.
      const slugRes = await fetch('/api/agent/storefront-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: cleanSlug,
          reservationToken: slugReservationToken,
        }),
      });
      const slugJson = await slugRes.json().catch(() => ({}));
      if (!slugRes.ok) {
        if (slugRes.status === 409) {
          throw new Error(slugJson?.error || 'Slug Is Reserved Or Already In Use');
        }
        throw new Error(slugJson?.error || 'Failed To Update Slug');
      }

      // 2) The new Display Name (User Name) goes through a dedicated endpoint
      //    to handle the cooldown logic and notifications.
      const nameRes = await fetch('/api/agent/storefront-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: displayName.trim(),
        }),
      });
      const nameJson = await nameRes.json().catch(() => ({}));
      if (!nameRes.ok) {
        throw new Error(nameJson?.error || 'Failed To Update User Name');
      }

      // 3) Everything else updates inline.
      const updatePayload: Record<string, any> = {
        slug: cleanSlug,
        logo_url: logoUrl.trim() || null,
        warehouse_address: {
          name: whName.trim(),
          street1: whStreet1.trim(),
          street2: whStreet2.trim() || null,
          city: whCity.trim(),
          state: whState.trim(),
          zip: whZip.trim(),
        },
      };

      const { error: updateError } = await supabase
        .from('agent_profiles')
        .update(updatePayload)
        .eq('id', agentId);

      if (updateError) {
        throw new Error(updateError.message);
      }
      toast.success('Storefront Configuration Updated Successfully');
      if (onSaveSuccess) {
        onSaveSuccess({ 
          ...updatePayload, 
          display_name: displayName.trim(),
          display_name_changed_at: nameJson.display_name_changed_at || displayNameChangedAt
        });
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed To Update Storefront Configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, width: '100%' }}>
      {/* Header Section */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="metal-text" style={{ fontSize: '1.4rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Storefront Configuration</h3>
        <p style={{ color: 'var(--silver)', fontSize: '0.95rem', lineHeight: 1.5, maxWidth: 600 }}>
          Manage your public-facing storefront identity, warehouse details, and payment options. Changes are reflected instantly.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Identity & Branding Section */}
        <section className="glass-panel" style={{ padding: 'var(--space-6)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'linear-gradient(180deg, #00C4BC 0%, #00E5FF 100%)' }} />
          <h4 style={{ fontSize: '1.1rem', color: 'var(--white)', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Brand Identity
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-5)' }}>
            <div>
              <UniqueField
                field="display_name"
                label="User Name"
                value={displayName}
                onChange={setDisplayName}
                onTokenChange={setDisplayNameReservationToken}
                excludeId={agentId}
                required
                disabled={!canChangeDisplayName}
              />
              {!canChangeDisplayName && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  User Name can only be changed once every 6 months.
                </div>
              )}
            </div>
            
            <UniqueField
              field="slug"
              label="URL Slug"
              value={slug}
              onChange={setSlug}
              onTokenChange={setSlugReservationToken}
              excludeId={agentId}
              urlPrefix="pepnationlab.com/"
              required
            />
          </div>

          <div style={{ marginTop: 'var(--space-5)' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 8, color: 'var(--grey-400)', fontSize: '0.85rem' }}>Store Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{ 
                width: 72, height: 72, borderRadius: 12, background: 'var(--surface-3)', 
                border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative'
              }}>
                {logoUrl ? (
                  <Image src={logoUrl} alt="Store Logo" width={200} height={200} unoptimized style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'var(--white)' }} />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--grey-500)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', 
                  borderRadius: 'var(--radius-md)', background: 'var(--teal)', color: 'var(--background)',
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'filter 0.2s'
                }} className="hover-brightness-110">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {logoUrl ? 'Replace Logo' : 'Upload Logo'}
                  <input
                    type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const supabase = createClient();
                      const ext = file.name.split('.').pop() || 'png';
                      const path = `agent-logos/${agentId}-${Date.now()}.${ext}`;
                      const { error: uploadError } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true });
                      if (uploadError) { toast.error('Failed to upload logo: ' + uploadError.message); return; }
                      const { data: pub } = supabase.storage.from('public-assets').getPublicUrl(path);
                      if (pub?.publicUrl) {
                        setLogoUrl(pub.publicUrl);
                        toast.success('Logo uploaded! Click Save to apply.');
                      }
                    }}
                  />
                </label>
                {logoUrl && (
                  <button type="button" onClick={() => setLogoUrl('')} style={{ fontSize: '0.75rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                    Remove Image
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Warehouse Location Section */}
        <section className="glass-panel" style={{ padding: 'var(--space-6)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'linear-gradient(180deg, #A855F7 0%, #D8B4FE 100%)' }} />
          <h4 style={{ fontSize: '1.1rem', color: 'var(--white)', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Warehouse Location
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)', marginTop: '-8px' }}>
            Where your inventory is shipped from. This ensures accurate shipping rates for your customers.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-4)' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ color: 'var(--grey-400)' }}>Warehouse Name</label>
              <input className="form-input" value={whName} onChange={e => setWhName(e.target.value)} placeholder="e.g. Primary Fulfillment Center" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ color: 'var(--grey-400)' }}>Street Address</label>
              <input className="form-input" value={whStreet1} onChange={e => setWhStreet1(e.target.value)} placeholder="123 Science Way" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ color: 'var(--grey-400)' }}>Apt / Suite (Optional)</label>
                <input className="form-input" value={whStreet2} onChange={e => setWhStreet2(e.target.value)} placeholder="Suite 100" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ color: 'var(--grey-400)' }}>City</label>
                <input className="form-input" value={whCity} onChange={e => setWhCity(e.target.value)} placeholder="Austin" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ color: 'var(--grey-400)' }}>State / Region</label>
                <input className="form-input" value={whState} onChange={e => setWhState(e.target.value)} placeholder="TX" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ color: 'var(--grey-400)' }}>ZIP / Postal Code</label>
                <input className="form-input" value={whZip} onChange={e => setWhZip(e.target.value)} placeholder="78701" />
              </div>
            </div>
          </div>
        </section>

        {/* Payment Methods Section (Rendered externally by AgentDashboardClient) */}
        {paymentMethodsNode && (
          <section className="glass-panel" style={{ padding: 'var(--space-6)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'linear-gradient(180deg, #F59E0B 0%, #FCD34D 100%)' }} />
            <h4 style={{ fontSize: '1.1rem', color: 'var(--white)', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              Payment Methods
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)', marginTop: '-8px' }}>
              Configure how your customers can pay you.
            </p>
            {paymentMethodsNode}
          </section>
        )}

      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
        <button
          type="button"
          onClick={handleUpdateProfile}
          disabled={loading}
          className="btn-neon-cyan"
          style={{
            minWidth: 200,
            padding: '12px 32px',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}
        >
          {loading ? (
            <span className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          )}
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
