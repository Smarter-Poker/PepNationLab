/**
 * Static OG image for the Research Library hub (/research).
 * Since this page doesn't have dynamic data in the OG image,
 * we use a fixed ImageResponse with premium branding.
 */
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  let fontData: ArrayBuffer | null = null;
  try {
    const res = await fetch('https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.ttf');
    if (res.ok) fontData = await res.arrayBuffer();
  } catch { /* fallback */ }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0A1018 0%, #0D1B2A 50%, #0A1018 100%)', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, left: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,196,188,0.14) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -80, right: 200, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

        <div style={{ display: 'flex', alignItems: 'center', padding: '40px 60px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#00C4BC', letterSpacing: '-0.5px' }}>PEP NATION LAB</div>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 12px' }} />
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>Research Library</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '56px 60px 0', justifyContent: 'center' }}>
          <div style={{ fontSize: 96, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-3px', marginBottom: 20 }}>Research</div>
          <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: '-3px', marginBottom: 32, background: 'linear-gradient(90deg, #00C4BC, #8B5CF6)', backgroundClip: 'text', color: 'transparent' }}>Library</div>
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, maxWidth: 640 }}>300+ research-grade peptides. Full monographs, evidence tiers, mechanisms, and AI-powered compound matching.</div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 40, padding: '0 60px 48px', marginTop: 'auto' }}>
          {[['300+', 'Compounds'], ['14', 'Therapeutic Areas'], ['AI', 'Match Engine']].map(([stat, label]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: '#00C4BC', lineHeight: 1 }}>{stat}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #00C4BC, rgba(139,92,246,0.8), transparent)' }} />
      </div>
    ),
    {
      ...size,
      ...(fontData ? { fonts: [{ name: 'Inter', data: fontData, weight: 900, style: 'normal' }] } : {}),
    }
  );
}
