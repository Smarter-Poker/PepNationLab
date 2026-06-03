/**
 * /research/a-z -- alphabetical encyclopedia index. Server component, groups
 * compounds by first letter (0-9 + A-Z) with a sticky letter rail at the top.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import GlobalSearchBar from '@/components/research/GlobalSearchBar';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';

export const metadata: Metadata = {
  title: 'A To Z Index | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

const LETTERS = ['0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

function bucketOf(name: string): string {
  const ch = name?.[0]?.toUpperCase() ?? '#';
  if (/^[0-9]$/.test(ch)) return '0-9';
  if (/^[A-Z]$/.test(ch)) return ch;
  return '0-9';
}

export default async function AToZPage() {
  const all = await getAllCompounds();
  const groups: Record<string, typeof all> = {};
  for (const l of LETTERS) groups[l] = [];
  for (const c of all) groups[bucketOf(c.display_name)].push(c);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link href="/research" style={{ color: '#00C4BC', fontSize: 13, textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          A To Z Index
        </h1>
        <p style={{ color: '#A8B4C0', fontSize: 16, marginTop: 8 }}>
          Every Compound In The Research Library, Alphabetized. Click Any Letter To Jump.
        </p>
      </header>

      <div style={{ marginBottom: 20 }}>
        <GlobalSearchBar compact />
      </div>

      <nav
        aria-label="Jump To Letter"
        style={{
          position: 'sticky',
          top: 60,
          zIndex: 20,
          background: 'rgba(5,10,15,0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          padding: '10px 0',
          borderBottom: '1px solid rgba(168,180,192,0.18)',
          marginBottom: 24,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {LETTERS.map((l) => {
          const count = groups[l].length;
          const disabled = count === 0;
          return (
            <a
              key={l}
              href={disabled ? undefined : `#letter-${l}`}
              style={{
                fontSize: 12,
                color: disabled ? '#404B57' : '#FFFFFF',
                background: disabled ? 'transparent' : 'rgba(0,196,188,0.12)',
                border: '1px solid rgba(168,180,192,0.25)',
                borderRadius: 8,
                padding: '4px 10px',
                pointerEvents: disabled ? 'none' : 'auto',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              {l}
            </a>
          );
        })}
      </nav>

      {LETTERS.filter((l) => groups[l].length > 0).map((letter) => (
        <section key={letter} id={`letter-${letter}`} style={{ marginBottom: 28, scrollMarginTop: 130 }}>
          <h2 style={{ fontSize: 22, color: '#00C4BC', borderBottom: '1px solid rgba(0,196,188,0.3)', paddingBottom: 6, marginBottom: 12 }}>
            {letter}
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {groups[letter].map((c) => {
              const t = evidenceTier(c.evidence_tier);
              return (
                <li key={c.slug}>
                  <Link
                    href={`/research/${c.slug}`}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(15,25,35,0.5)',
                      border: '1px solid rgba(168,180,192,0.15)',
                      textDecoration: 'none',
                      color: '#FFFFFF',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{c.display_name}</span>
                    <span style={{
                      fontSize: 10, color: t.color, border: `1px solid ${t.color}`,
                      padding: '1px 8px', borderRadius: 999, fontWeight: 700,
                    }}>{t.label}</span>
                    {c.plain_summary && (
                      <span style={{ flex: 1, color: '#A8B4C0', fontSize: 13, minWidth: 200 }}>
                        {c.plain_summary}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <BrowseSurfaceNav />
    </div>
  );
}
