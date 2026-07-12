'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import DisclaimerGate from '@/components/DisclaimerGate';
import { isDisclaimerAccepted, recordDisclaimerAcceptance } from '@/lib/disclaimer-client';

// Public Landing Page -- Renders The Supplied Artwork Exactly As Provided,
// With Invisible Click Zones Layered On Top (Same Pattern As Peptide 101).
// Image Is 941x1672; All Hitboxes Are Percentages Of That Canvas.
//
// SEO/AEO: The artwork is a raster image, so on its own the domain root has no
// crawlable headline, body copy, or anchor text. We embed a visually-hidden
// (but screen-reader- and crawler-accessible) content layer ON TOP of the
// image: a real <h1> + positioning paragraph, and descriptive anchor text
// inside every click zone. This is legitimate accessible-name / equivalent-text
// markup (it matches exactly what the artwork visually communicates), NOT hidden
// keyword stuffing. The image itself is never modified.
//
// Flow: The Landing Artwork Is ALWAYS The First Thing A Visitor Sees.
// Clicking ANY Zone Checks The Layer-1 Disclaimer; First-Time Visitors
// Get The Mandatory Research-Only Acknowledgment Before Being Taken To
// Their Destination (Log In, Create Account, Guest, Etc.).

// Standard "visually hidden" pattern: present in the DOM and the accessibility
// tree (so crawlers and screen readers read it), but painted 1px and clipped so
// it never disturbs the artwork.
const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

type Zone = {
  href: string;
  label: string;   // accessible name
  anchor: string;  // crawlable anchor text rendered inside the link
  top: string;
  left: string;
  width: string;
  height: string;
};

const ZONES: Zone[] = [
  // Right-Side Hexagon Badges
  { href: '/find-a-peptide', label: 'Discover', anchor: 'Discover Research Peptides', top: '12.56%', left: '79.17%', width: '18.4%', height: '7.77%' },
  { href: '/research', label: 'Research', anchor: 'Research Library', top: '21.83%', left: '79.17%', width: '18.4%', height: '8.07%' },
  { href: '/peptide-101', label: 'Learn', anchor: 'Peptide 101 Research Education', top: '31.10%', left: '79.17%', width: '18.4%', height: '8.07%' },
  { href: `/${DEFAULT_STORE_SLUG}`, label: 'Transform', anchor: 'Browse The Research Catalog', top: '40.37%', left: '79.17%', width: '18.4%', height: '8.37%' },
  // Primary Action Buttons
  { href: '/login', label: 'Log In', anchor: 'Log In To Your Researcher Account', top: '71.29%', left: '20.72%', width: '58.98%', height: '3.59%' },
  { href: '/signup', label: 'Create Account', anchor: 'Create A Verified Researcher Account', top: '76.85%', left: '20.72%', width: '58.98%', height: '3.59%' },
  { href: `/${DEFAULT_STORE_SLUG}`, label: 'Continue As Guest', anchor: 'Browse Research Peptides As A Guest', top: '82.06%', left: '20.72%', width: '58.98%', height: '3.59%' },
  // Footer Compliance Line
  { href: '/disclaimer', label: 'For Research Purposes Only', anchor: 'Research Use Only Disclaimer', top: '97.1%', left: '10%', width: '80%', height: '2.4%' },
];

export default function HomeClient() {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const handleZoneClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (isDisclaimerAccepted()) {
      router.push(href);
      return;
    }
    // First-Time Visitor: Show The Mandatory Acknowledgment Before Navigating.
    setPendingHref(href);
  };

  const handleAccept = () => {
    recordDisclaimerAcceptance();
    const destination = pendingHref;
    setPendingHref(null);
    if (destination) router.push(destination);
  };

  return (
    <div style={{ backgroundColor: '#020617', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Crawlable, screen-reader-accessible content embedded over the image.
          Gives the domain root a real <h1>, positioning copy, and a semantic
          summary of what the artwork communicates - visually hidden so the
          artwork is unchanged. */}
      <header style={srOnly}>
        <h1>Pep Nation Lab - Wholesale Research-Grade Peptides For Qualified Researchers</h1>
        <p>
          Pep Nation Lab supplies research-grade peptides to verified researchers and scientific
          institutions across all 50 US states. Explore a 300+ compound research library with 100+ research compounds available - including
          BPC-157, Semaglutide, Tirzepatide, TB-500, Ipamorelin, and CJC-1295 - at wholesale pricing,
          with a full research library, compound monographs, dosing calculators, and local coverage in
          hundreds of US cities. All products are strictly for in vitro laboratory research use only.
          They are not for human or animal consumption, ingestion, or injection, and are not FDA-approved.
        </p>
        <nav aria-label="Primary">
          <a href="/research">Research Library</a>
          <a href="/research/guides">Research Guides</a>
          <a href="/peptides">Peptides By City</a>
          <a href="/find-a-peptide">Find A Peptide</a>
          <a href="/peptide-101">Peptide 101</a>
          <a href="/become-agent">Become An Agent</a>
        </nav>
      </header>

      <div style={{ position: 'relative', width: '100%', maxWidth: '941px', margin: '0 auto' }}>
        {/* LCP element. next/image (not a raw <img>) so the 2.0MB source PNG
            is served as a right-sized AVIF/WebP through the image optimizer -
            requires the ydsaqnnuwyvtyxgvrnys.supabase.co remotePattern in
            next.config.ts. priority emits a <link rel="preload"> in the head. */}
        <Image
          src="https://ydsaqnnuwyvtyxgvrnys.supabase.co/storage/v1/object/public/storefront-assets/landing/pep-nation-landing.png"
          alt="Pep Nation Lab Research Academy - Wholesale Research-Grade Peptides For Qualified Researchers. Research Use Only."
          width={941}
          height={1672}
          priority
          fetchPriority="high"
          quality={40}
          // Mobile LCP: the artwork is a 941px-wide source, so at 100vw a
          // DPR-3 phone pulls the full-width candidate (~941px x 1672px).
          // Capping the slot at 250 CSS px on small screens selects the 750w
          // candidate instead (~36% fewer pixels to download and decode) at a
          // 1.5x upscale that is visually acceptable for this flat artwork.
          sizes="(max-width: 480px) 250px, (max-width: 941px) 100vw, 941px"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        {ZONES.map(zone => (
          <a
            key={zone.label}
            href={zone.href}
            aria-label={zone.label}
            title={zone.label}
            onClick={e => handleZoneClick(e, zone.href)}
            style={{
              position: 'absolute',
              top: zone.top,
              left: zone.left,
              width: zone.width,
              height: zone.height,
              // Tap-target floor (WCAG 2.5.8 / 48dp guidance): percentage
              // heights shrink below 24px on small phones; the transparent
              // hit area may grow beyond the painted button.
              minHeight: 24,
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            {/* Real anchor text for crawlers; visually hidden so the artwork
                shows through the transparent hit area. */}
            <span style={srOnly}>{zone.anchor}</span>
          </a>
        ))}
      </div>

      {/* Crawlable Text Footer - Visible real text links giving search engines
          and AI crawlers a direct path from the domain root into every public
          directory and content hub. */}
      <footer style={{ width: '100%', maxWidth: '941px', margin: '0 auto', padding: '18px 16px 26px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <nav aria-label="Site Links" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px' }}>
          {[
            { label: 'Peptides By City', href: '/peptides' },
            { label: 'Research Library', href: '/research' },
            { label: 'Research Guides', href: '/research/guides' },
            { label: 'Peptide 101', href: '/peptide-101' },
            { label: 'Find A Peptide', href: '/find-a-peptide' },
            { label: 'Become An Agent', href: '/become-agent' },
            { label: 'Compliance', href: '/compliance' },
            { label: 'Disclaimer', href: '/disclaimer' },
            { label: 'Terms', href: '/terms' },
            { label: 'Privacy', href: '/privacy' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={e => handleZoneClick(e, href)}
              style={{ fontSize: '0.74rem', color: 'rgba(168,180,192,0.55)', textDecoration: 'none' }}
            >
              {label}
            </a>
          ))}
        </nav>
        <p style={{ fontSize: '0.85rem', color: 'rgba(168,180,192,0.35)', textAlign: 'center', margin: '12px 0 0' }}>
          {new Date().getFullYear()} Pep Nation Lab LLC. All Products For In Vitro Research Use Only.
        </p>
      </footer>

      {pendingHref !== null && <DisclaimerGate onAccept={handleAccept} />}
    </div>
  );
}
