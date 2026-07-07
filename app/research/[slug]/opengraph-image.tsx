/**
 * Dynamic OG image for each compound monograph page.
 * File-based metadata convention: Next.js auto-wires this to
 * og:image and twitter:image for every /research/[slug] route.
 *
 * Uses ImageResponse (next/og) with Satori under the hood.
 * Only flexbox + subset CSS supported — no grid, no backdrop-filter.
 */
import { ImageResponse } from 'next/og';
import { createServiceClient } from '@/lib/supabase/server';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TIER_COLORS: Record<string, string> = {
  'FDA Approved':        '#00C4BC',
  'Phase III Clinical':  '#3B82F6',
  'Phase II Clinical':   '#8B5CF6',
  'Phase I Clinical':    '#A78BFA',
  'Preclinical':         '#F59E0B',
  'Emerging':            '#6B7280',
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  let category = 'Research Compound';
  let evidenceTier = 'Research Grade';
  let summary = 'Research-use-only reference compound.';

  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('compounds')
      .select('display_name, category, evidence_tier, plain_summary')
      .eq('slug', slug)
      .maybeSingle();

    if (data) {
      name = data.display_name ?? name;
      category = data.category ?? category;
      evidenceTier = data.evidence_tier ?? evidenceTier;
      summary = (data.plain_summary ?? summary).slice(0, 110);
    }
  } catch {
    // Preview build — fall back to slug-derived text
  }

  const tierColor = TIER_COLORS[evidenceTier] ?? '#00C4BC';

  let fontData: ArrayBuffer | null = null;
  try {
    const res = await fetch('https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.ttf');
    if (res.ok) fontData = await res.arrayBuffer();
  } catch { /* no font — Satori falls back */ }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0A1018 0%, #0D1B2A 50%, #0A1018 100%)', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
        {/* Teal glow top-left */}
        <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,196,188,0.15) 0%, transparent 70%)' }} />
        {/* Purple glow bottom-right */}
        <div style={{ position: 'absolute', bottom: -80, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 60px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#00C4BC', letterSpacing: '-0.5px' }}>PEP NATION LAB</div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', marginTop: 2 }} />
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>Research Library</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: `${tierColor}22`, border: `1px solid ${tierColor}66`, borderRadius: 100, padding: '6px 18px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: tierColor, marginRight: 8 }} />
            <span style={{ fontSize: 14, color: tierColor, fontWeight: 600 }}>{evidenceTier}</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '48px 60px 0', justifyContent: 'center' }}>
          <div style={{ display: 'flex', marginBottom: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 14px', fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{category}</div>
          </div>
          <div style={{ fontSize: name.length > 20 ? 60 : name.length > 14 ? 72 : 84, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.05, letterSpacing: '-2px', marginBottom: 24 }}>{name}</div>
          <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, maxWidth: 720, fontWeight: 400 }}>{summary}</div>
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px 44px', marginTop: 'auto' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>For Research Use Only — Not For Human Consumption</div>
          <div style={{ width: 120, height: 3, background: `linear-gradient(90deg, ${tierColor}, transparent)`, borderRadius: 2 }} />
        </div>

        {/* Bottom edge */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${tierColor}, rgba(139,92,246,0.8), transparent)` }} />
      </div>
    ),
    {
      ...size,
      ...(fontData ? { fonts: [{ name: 'Inter', data: fontData, weight: 900, style: 'normal' }] } : {}),
    }
  );
}
