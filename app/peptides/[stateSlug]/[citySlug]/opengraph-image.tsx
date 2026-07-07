/**
 * Dynamic OG image for city landing pages (/peptides/[state]/[city]).
 * File-based ImageResponse — auto-wired to og:image by Next.js.
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCity } from '@/lib/cities/cities-data';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function toTitleCase(str: string) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function Image({ params }: { params: Promise<{ stateSlug: string; citySlug: string }> }) {
  const { stateSlug, citySlug } = await params;

  // Prefer real display names from the data set; fall back to slug title-casing.
  const city = getCity(stateSlug, citySlug);
  const cityName = city?.name ?? toTitleCase(citySlug);
  const stateName = city?.state ?? toTitleCase(stateSlug);

  // Canonical store-catalog figure used across all city pages.
  const compoundCount = '100+';

  // Local font — no network fetch at render time (the old Google Fonts fetch
  // added latency and failed silently when blocked).
  let fontData: ArrayBuffer | null = null;
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'fonts', 'Inter-Bold.otf'));
    fontData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch { /* fallback to default font */ }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0A1018 0%, #0D1B2A 60%, #0A1018 100%)', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
        {/* Teal glow */}
        <div style={{ position: 'absolute', top: -120, left: -80, width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,196,188,0.12) 0%, transparent 70%)' }} />
        {/* Purple glow */}
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

        {/* Top branding bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 60px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#00C4BC', letterSpacing: '-0.5px' }}>PEP NATION LAB</div>
            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>Local Research Supply</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.35)', borderRadius: 100, padding: '5px 16px', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00C4BC' }} />
            <span style={{ fontSize: 13, color: '#00C4BC', fontWeight: 600 }}>Research Use Only</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '52px 60px 0', justifyContent: 'center' }}>
          {/* State label */}
          <div style={{ display: 'flex', marginBottom: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '3px 14px', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{stateName}</div>
          </div>

          {/* City name */}
          <div style={{ fontSize: cityName.length > 16 ? 64 : cityName.length > 10 ? 80 : 96, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-3px', marginBottom: 28 }}>{cityName}</div>

          {/* Subline */}
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, maxWidth: 680 }}>
            Research-grade peptide supply available to qualified researchers in {cityName}, {stateName}.
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 32, marginTop: 36 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#00C4BC', lineHeight: 1 }}>{compoundCount}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Compounds</span>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', alignSelf: 'stretch' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#8B5CF6', lineHeight: 1 }}>300+</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Research Library</span>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', alignSelf: 'stretch' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>RUO</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Grade Quality</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px 40px', marginTop: 'auto' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>pepnationlab.com/peptides/{stateSlug}/{citySlug}</div>
          <div style={{ width: 100, height: 3, background: 'linear-gradient(90deg, #00C4BC, transparent)', borderRadius: 2 }} />
        </div>

        {/* Bottom edge accent */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #00C4BC, rgba(139,92,246,0.8), transparent)' }} />
      </div>
    ),
    {
      ...size,
      ...(fontData ? { fonts: [{ name: 'Inter', data: fontData, weight: 900, style: 'normal' }] } : {}),
    }
  );
}
