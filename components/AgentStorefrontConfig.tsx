'use client';

import React from 'react';
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
  primaryColor: string;
  setPrimaryColor: (val: string) => void;
  // Warehouse address (JSONB) - read/write directly to agent_profiles.
  warehouseAddress?: Record<string, any> | null;
  // Vacation mode - flips agent_profiles.is_active.
  isActive?: boolean | null;
  // Volume (tiered) pricing - on by default, agents can disable.
  volumePricingEnabled: boolean;
  setVolumePricingEnabled: (val: boolean) => void;
  agentId: string;
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
  primaryColor, setPrimaryColor,
  warehouseAddress,
  isActive,
  volumePricingEnabled,
  setVolumePricingEnabled,
  agentId,
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

  // Vacation mode (is_active): true = open, false = paused.
  const [vacationToggle, setVacationToggle] = React.useState<boolean>(isActive !== false);

  async function handleVacationToggle(next: boolean) {
    setVacationToggle(next);
    const supabase = createClient();
    const { error } = await supabase
      .from('agent_profiles')
      .update({ is_active: next })
      .eq('id', agentId);
    if (error) {
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

      // 2) Everything else updates inline (RLS allows the owner to update
      //    their own agent_profiles row).

      const updatePayload: Record<string, any> = {
        display_name: displayName.trim(),
        slug: cleanSlug,
        logo_url: logoUrl.trim() || null,
        primary_color: primaryColor,
        volume_pricing_enabled: volumePricingEnabled,
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
        if ((updateError as any).code === '23505') {
          throw new Error('Display Name Is Already Taken - Try Another.');
        }
        throw new Error(updateError.message);
      }
      toast.success('Storefront Configuration Updated Successfully');
      if (onSaveSuccess) onSaveSuccess(updatePayload);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed To Update Storefront Configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="glass-panel">
        <div className="" style={{ padding: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
          <div>
            <h3 className="metal-text" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Storefront Setup</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="grid-2">
            <UniqueField
              field="display_name"
              label="Display Name"
              value={displayName}
              onChange={setDisplayName}
              onTokenChange={setDisplayNameReservationToken}
              excludeId={agentId}
              required
            />
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

          <div className="grid-2">
            <div className="form-group" style={{ marginTop: 0 }}>
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
                  display: 'inline-flex', alignItems: 'center', gap: 6, height: 46,
                  padding: '0 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-3)', border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', fontSize: '0.85rem', color: 'var(--silver)',
                  transition: 'background 0.2s',
                }}
                className="hover-bg-surface-2"
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
            <div className="form-group" style={{ marginTop: 0 }}>
              <label className="form-label">Primary Brand Color</label>
              <div style={{ display: 'flex', gap: 'var(--space-3)', height: 46, alignItems: 'center' }}>
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: 48, height: 44, padding: 0, border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'transparent' }} />
                <input type="text" className="form-input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} pattern="^#+([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$" style={{ height: '100%', margin: 0 }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button
              type="button"
              onClick={handleUpdateProfile}
              disabled={loading}
              className="btn-neon-cyan"
              style={{
                minWidth: 160,
                padding: '10px 24px',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
