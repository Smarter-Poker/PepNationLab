/**
 * Dynamic OG image for state landing pages (/peptides/[stateSlug]).
 */
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function toTitleCase(str: string) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function Image({ params }: { params: Promise<{ stateSlug: string }> }) {
  const { stateSlug } = await params;
  const stateName = toTitleCase(stateSlug);

  let fontData: ArrayBuffer | null = null;
  try {
    const res = await fetch('https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2JL7W0Q5n-wU.woff2');
    if (res.ok) fontData = await res.arrayBuffer();
  } catch { /* fallback */ }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0A1018 0%, #0D1B2A 60%, #0A1018 100%)', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,196,188,0.13) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -80, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 60px 0' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#00C4BC', letterSpacing: '-0.5px' }}>PEP NATION LAB</div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', borderRadius: 100, padding: '5px 16px', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00C4BC' }} />
            <span style={{ fontSize: 13, color: '#00C4BC', fontWeight: 600 }}>Research Use Only</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '60px 60px 0', justifyContent: 'center' }}>
          <div style={{ display: 'flex', marginBottom: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '3px 14px', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>State Directory</div>
          </div>
          <div style={{ fontSize: stateName.length > 14 ? 72 : 90, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-3px', marginBottom: 24 }}>{stateName}</div>
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, maxWidth: 640 }}>Browse research peptide supply locations across {stateName}. Qualified researchers only.</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px 40px', marginTop: 'auto' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>pepnationlab.com/peptides/{stateSlug}</div>
          <div style={{ width: 100, height: 3, background: 'linear-gradient(90deg, #00C4BC, transparent)', borderRadius: 2 }} />
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
