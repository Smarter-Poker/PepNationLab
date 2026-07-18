import React from 'react';
import Link from 'next/link';
import type { City } from '@/lib/cities/cities-data';
import type { CityCompound } from '@/lib/cities/city-compounds';
import { getResearchAnchors } from '@/lib/cities/research-anchors';
import { isPilotCompoundCity, PILOT_COMPOUND_SLUGS } from '@/lib/cities/tier3-pilot';
import { getRegionArea } from '@/lib/cities/city-content';

function hash(citySlug: string, compoundSlug: string): number {
  const s = `${citySlug}|${compoundSlug}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], n: number): T {
  return arr[n % arr.length];
}

function listOf(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function pop(city: City): string {
  const p = city.population;
  if (p >= 1000000) return `${(p / 1000000).toFixed(1)} million`;
  if (p >= 1000) return `${Math.round(p / 1000)},000`;
  return `${p}`;
}

interface Props {
  city: City;
  compound: CityCompound;
}

export function CompoundCityNarrative({ city, compound }: Props) {
  if (!isPilotCompoundCity(city, compound.slug)) return null;

  const h = hash(city.slug, compound.slug);
  const region = city.region || 'the local area';
  const area = getRegionArea(region);
  const anchors = getResearchAnchors(city.region);
  const anchorNames = anchors ? anchors.slice(0, 3).map((a) => a.name) : [];
  const county = city.county ? `${city.county} County` : null;

  // Paragraph 1: Research Landscape
  const p1Open = pick(
    [
      `The ${city.name} research ecosystem remains an active hub for laboratory-grade peptide research`,
      `${city.name} anchors a growing concentration of scientific and clinical investigations across the ${area}`,
      `Among ${city.state} research communities, ${city.name} demonstrates sustained demand for research-grade compounds`,
    ],
    h
  );
  
  const p1Pop = pick(
    [
      `Home to roughly ${pop(city)} residents${county ? ` in ${county}` : ''}, the city supports independent investigators and specialized lab groups`,
      `With a population near ${pop(city)}${county ? ` across ${county}` : ''}, it sustains a vital base of research professionals`,
      `A metro of about ${pop(city)} people${county ? ` in ${county}` : ''}, ${city.name} draws on a robust scientific workforce`,
    ],
    h >> 2
  );

  const p1Anchor = anchorNames.length > 0
    ? pick(
        [
          ` that operate alongside established regional institutions such as ${listOf(anchorNames)}. Pep Nation Lab serves this broader ecosystem by supplying research-grade peptides independently, without affiliation to these organizations.`,
          ` positioned near major research anchors including ${listOf(anchorNames)}. As an independent supplier, Pep Nation Lab meets the needs of investigators across this corridor without claiming affiliation with any specific institution.`,
        ],
        h >> 4
      )
    : ` drawing on a mix of independent labs and private research groups. Pep Nation Lab supplies these investigators as an independent, unaffiliated distributor.`;

  const p1 = `${p1Open}. ${p1Pop}${p1Anchor}`;

  // Paragraph 2: Compound + City Context
  const p2Intro = pick(
    [
      `${compound.displayName} continues to be a focal point for laboratories in ${city.name}.`,
      `For verified researchers in ${city.name}, access to pure ${compound.displayName} is critical.`,
      `The local focus on ${compound.displayName} aligns with broader regional research trends.`
    ],
    h >> 3
  );

  const p2Positioning = compound.positioning;
  const p2Blurb = city.localBlurb ? ` ${city.localBlurb}` : '';
  const p2 = `${p2Intro} ${p2Positioning}${p2Blurb}`;

  // Paragraph 3: Internal Links
  const otherCompounds = PILOT_COMPOUND_SLUGS.filter((s) => s !== compound.slug);
  const linkCount = 2 + (h % 2); // 2 or 3 links
  const selectedOtherSlugs = [];
  let tempH = h;
  for (let i = 0; i < linkCount; i++) {
    const idx = tempH % otherCompounds.length;
    selectedOtherSlugs.push(otherCompounds[idx]);
    otherCompounds.splice(idx, 1);
    tempH = tempH >> 1;
  }

  return (
    <section style={{ padding: 'clamp(40px, 6vw, 72px) 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="container" style={{ maxWidth: 820, margin: '0 auto' }}>
        <h2 style={{ color: 'var(--white, #fff)', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-4, 16px)' }}>
          Research Landscape: {compound.displayName} In {city.name}
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)', color: 'var(--silver-light, #D0DAE4)', fontSize: '0.95rem', lineHeight: 1.75 }}>
          <p style={{ margin: 0 }}>{p1}</p>
          <p style={{ margin: 0 }}>{p2}</p>
          <div style={{ padding: 'var(--space-4, 16px)', background: 'linear-gradient(180deg, rgba(22,34,48,0.6) 0%, rgba(15,25,35,0.6) 100%)', border: '1px solid rgba(192,184,168,0.12)', borderRadius: 'var(--radius-xl, 18px)', marginTop: 'var(--space-2, 8px)' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--white, #fff)', fontWeight: 700, margin: '0 0 var(--space-3, 12px) 0' }}>Explore More In {city.name}</h3>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>
                <Link href={`/peptides/${city.stateSlug}/${city.slug}`} style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none', fontWeight: 500 }}>
                  View the complete {city.name} Research Catalog
                </Link>
              </li>
              {selectedOtherSlugs.map(slug => (
                <li key={slug}>
                  <Link href={`/peptides/${city.stateSlug}/${city.slug}/${slug}`} style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none', fontWeight: 500 }}>
                    Research {slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} in {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
