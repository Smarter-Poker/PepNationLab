'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IframeLink from '@/components/ui/IframeLink';
import Image from 'next/image';

export default function ThemeBuilder() {
  const [theme, setTheme] = useState<any>(null);
  const [primary, setPrimary] = useState('#00C4BC');
  const [secondary, setSecondary] = useState('#162230');
  const [accent, setAccent] = useState('#FFB800');
  const [tagline, setTagline] = useState('');
  const [hero, setHero] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/agent/storefront/theme', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j?.theme) return;
        setTheme(j.theme);
        if (j.theme.primary_color) setPrimary(j.theme.primary_color);
        if (j.theme.secondary_color) setSecondary(j.theme.secondary_color);
        if (j.theme.accent_color) setAccent(j.theme.accent_color);
        if (j.theme.tagline) setTagline(j.theme.tagline);
        if (j.theme.hero_image_url) setHero(j.theme.hero_image_url);
      });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch('/api/agent/storefront/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_color: primary,
          secondary_color: secondary,
          accent_color: accent,
          tagline: tagline || null,
          hero_image_url: hero || null,
        }),
      });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'save_failed'); }
      toast.success('Theme Saved');
    } catch (e: any) {
      toast.error('Save Failed: ' + (e.message || 'Unknown'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pnl-themebuilder-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(min(280px, 100%), 1fr) minmax(min(260px, 100%), 1fr)', gap: 14 }}>
      <section className="glass-panel" style={{ padding: 16, borderRadius: 12 }}>
        <h3 style={{ color: 'var(--white)', fontSize: '1rem', marginTop: 0 }}>Storefront Theme</h3>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Primary Color</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
              style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer' }} />
            <input type="text" value={primary} onChange={e => setPrimary(e.target.value)}
              style={{ flex: 1, padding: 12, fontSize: '16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
                border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Secondary Color</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)}
              style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer' }} />
            <input type="text" value={secondary} onChange={e => setSecondary(e.target.value)}
              style={{ flex: 1, padding: 12, fontSize: '16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
                border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Accent Color</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
              style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer' }} />
            <input type="text" value={accent} onChange={e => setAccent(e.target.value)}
              style={{ flex: 1, padding: 12, fontSize: '16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
                border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tagline</span>
          <input type="text" value={tagline} maxLength={200} onChange={e => setTagline(e.target.value)}
            placeholder="Your Storefront Tagline"
            style={{ width: '100%', marginTop: 4, padding: 12, fontSize: '16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
              border: '1px solid rgba(255,255,255,0.1)' }} />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hero Image URL</span>
          <input type="url" value={hero} onChange={e => setHero(e.target.value)}
            placeholder="https://..."
            style={{ width: '100%', marginTop: 4, padding: 12, fontSize: '16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
              border: '1px solid rgba(255,255,255,0.1)' }} />
        </label>

        <button onClick={save} disabled={saving} style={{
          width: '100%', padding: 14, borderRadius: 8, minHeight: 44,
          background: 'var(--teal)', color: 'var(--black)', border: 'none',
          fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
        }}>{saving ? 'Saving...' : 'Save Theme'}</button>
      </section>

      <section className="glass-panel" style={{ padding: 16, borderRadius: 12 }}>
        <h3 style={{ color: 'var(--white)', fontSize: '1rem', marginTop: 0 }}>Live Preview</h3>
        <div style={{
          border: `2px solid ${primary}`, borderRadius: 12, padding: 16,
          background: `linear-gradient(135deg, ${primary}22, ${secondary}55)`,
        }}>
          <div style={{ color: primary, fontWeight: 800, fontSize: '1.2rem' }}>
            {theme?.display_name ?? 'Your Storefront'}
          </div>
          {tagline && <div style={{ color: 'var(--grey-200)', fontSize: '0.88rem', marginTop: 4 }}>{tagline}</div>}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '8px 12px', borderRadius: 6, background: primary, color: '#000', fontWeight: 700, fontSize: '0.82rem' }}>Primary</span>
            <span style={{ padding: '8px 12px', borderRadius: 6, background: secondary, color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>Secondary</span>
            <span style={{ padding: '8px 12px', borderRadius: 6, background: accent, color: '#000', fontWeight: 700, fontSize: '0.82rem' }}>Accent</span>
          </div>
          {hero && (
            <div style={{ position: 'relative', width: '100%', height: 200, marginTop: 14 }}>
              <Image src={hero} alt="Hero preview" fill unoptimized style={{ borderRadius: 8, objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </div>
        {theme?.slug && (
          <IframeLink href={`/${theme.slug}?preview=1`} style={{
            display: 'inline-block', marginTop: 12, color: 'var(--teal)', fontWeight: 700, fontSize: '0.88rem',
          }}>Open Live Storefront →</IframeLink>
        )}
      </section>
    </div>
  );
}
