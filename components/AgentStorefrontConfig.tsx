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
  shippoApiKey: string;
  setShippoApiKey: (val: string) => void;
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
  agentId
}: AgentStorefrontConfigProps) {
  const [loading, setLoading] = React.useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    
    if (!/^[a-z0-9\-]+$/.test(cleanSlug)) {
      toast.error('Storefront URL Slug Must Only Contain Lowercase Letters, Numbers, And Hyphens.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { error: updateError } = await supabase
        .from('agent_profiles')
        .update({
          display_name: displayName.trim(),
          slug: cleanSlug,
          logo_url: logoUrl.trim() || null,
          tagline: tagline.trim() || null,
          bio: bio.trim() || null,
          primary_color: primaryColor,
          payment_handles: {
            zelle: zelleHandle.trim(),
            cashapp: cashappHandle.trim(),
            venmo: venmoHandle.trim(),
            apple_pay: applePayHandle.trim()
          },
          shippo_api_key: shippoApiKey.trim() || null
        })
        .eq('id', agentId);

      if (updateError) {
        throw new Error(updateError.message);
      }
      toast.success('Storefront Configuration Updated Successfully!');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed To Update Storefront Configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="card-metal" style={{ padding: 'var(--space-8)' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Storefront Setup</h3>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginBottom: 'var(--space-6)' }}>
          Configure Your Public Facing White-Label Storefront.
        </p>

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
            These details will be shown to your customers after they complete their order, instructing them where to send funds.
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

          <h4 style={{ color: 'var(--teal)', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>Automated Shipping Integration (Optional)</h4>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
            Connect your own Shippo account to instantly purchase and print USPS/UPS shipping labels directly from the orders dashboard without leaving the site.
          </p>

          <div className="form-group">
            <label className="form-label">Shippo API Token (Live Token)</label>
            <input type="password" placeholder="shippo_live_..." className="form-input" value={shippoApiKey} onChange={(e) => setShippoApiKey(e.target.value)} />
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
