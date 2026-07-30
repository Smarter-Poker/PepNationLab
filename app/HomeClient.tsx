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
// Only "Continue As Guest" (entering the store without an account) shows the
// Research-Only acknowledgment before navigating. Log In and Create Account go
// straight through -- sign-up and checkout each carry their own acknowledgment.

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

function buildZones(guestStoreSlug: string | null, refCode: string | null): Zone[] {
  // Guests who scanned an agent QR are locked to that agent's storefront (see
  // lib/ref-lock.ts) -- the middleware only lets an unauthenticated guest
  // browse that one store, so "Continue As Guest" must go there rather than
  // the house store. Without a lock, the house-store behavior is unchanged.
  const guestStoreHref = guestStoreSlug ? `/${guestStoreSlug}` : `/${DEFAULT_STORE_SLUG}`;
  // Carry the locked referral code into sign-up so the form shows the locked
  // "referred by" field.
  const signupHref = refCode ? `/signup?ref=${encodeURIComponent(refCode)}` : '/signup';
  return [
    // Right-Side Hexagon Badges
    { href: '/find-a-peptide', label: 'Discover', anchor: 'Discover Research Peptides', top: '12.56%', left: '79.17%', width: '18.4%', height: '7.77%' },
    { href: '/research', label: 'Research', anchor: 'Research Library', top: '21.83%', left: '79.17%', width: '18.4%', height: '8.07%' },
    { href: '/peptide-101', label: 'Learn', anchor: 'Peptide 101 Research Education', top: '31.10%', left: '79.17%', width: '18.4%', height: '8.07%' },
    { href: `/${DEFAULT_STORE_SLUG}`, label: 'Transform', anchor: 'Browse The Research Catalog', top: '40.37%', left: '79.17%', width: '18.4%', height: '8.37%' },
    // Primary Action Buttons
    { href: '/login', label: 'Log In', anchor: 'Log In To Your Researcher Account', top: '71.29%', left: '20.72%', width: '58.98%', height: '3.59%' },
    { href: signupHref, label: 'Create Account', anchor: 'Create A Verified Researcher Account', top: '76.85%', left: '20.72%', width: '58.98%', height: '3.59%' },
    { href: guestStoreHref, label: 'Continue As Guest', anchor: 'Browse Research Peptides As A Guest', top: '82.06%', left: '20.72%', width: '58.98%', height: '3.59%' },
    // Footer Compliance Line
    { href: '/disclaimer', label: 'For Research Purposes Only', anchor: 'Research Use Only Disclaimer', top: '97.1%', left: '10%', width: '80%', height: '2.4%' },
  ];
}

type HomeClientProps = {
  /** Agent storefront slug from the QR referral lock (lib/ref-lock.ts), if any. */
  guestStoreSlug?: string | null;
  /** Referral code from the QR referral lock, if any. */
  refCode?: string | null;
};

export default function HomeClient({ guestStoreSlug = null, refCode = null }: HomeClientProps) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const zones = buildZones(guestStoreSlug, refCode);

  // Only ENTERING THE STORE as a guest requires the Research-Only
  // acknowledgment here. "Continue As Guest" points at the QR-locked agent
  // storefront when a referral lock is present (house store otherwise), and
  // the "Browse The Research Catalog" badge points at the house store, so we
  // gate by destination against both. Every other zone (Log In, Create
  // Account, and the research / education links) navigates straight through
  // -- sign-up and checkout carry their own.
  const STORE_HREF = `/${DEFAULT_STORE_SLUG}`;
  const GUEST_STORE_HREF = guestStoreSlug ? `/${guestStoreSlug}` : STORE_HREF;

  const handleZoneClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const isStoreEntry = (base: string) =>
      href === base ||
      href.startsWith(`${base}?`) ||
      href.startsWith(`${base}#`);
    const isGuestStoreEntry = isStoreEntry(STORE_HREF) || isStoreEntry(GUEST_STORE_HREF);
    if (isGuestStoreEntry && !isDisclaimerAccepted()) {
      // First-time guest entering the store: acknowledge first, then navigate.
      setPendingHref(href);
      return;
    }
    router.push(href);
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
          // Slow-mobile / SMS-launch: the tap zones below are positioned over
          // this artwork, so on a weak connection the above-the-fold nav would
          // be an invisible blank until the optimized image arrives. An inline
          // ~200-byte LQIP (8x14 WebP derived from the artwork itself) paints a
          // recognizable blurred preview immediately at FCP, so the layout and
          // where-to-tap are visible from the first frame. Zero extra request.
          placeholder="blur"
          blurDataURL="data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAADwAQCdASoIAA4AAwBSJZACdAYsjkQqUwAA/vXtohMfCrMd0H9GOtFJCx/IHpXBGBsFAcIgwsMVBmp8ZtuTTKGp0nAp/SjpN+0+hb6GMfx4WyrfBPjlQ1PxVgA="
          // Mobile LCP: the artwork is a 941px-wide source, so at 100vw a
          // DPR-3 phone pulls the full-width candidate (~941px x 1672px).
          // Capping the slot at 250 CSS px on small screens selects the 750w
          // candidate instead (~36% fewer pixels to download and decode) at a
          // 1.5x upscale that is visually acceptable for this flat artwork.
          sizes="(max-width: 480px) 250px, (max-width: 941px) 100vw, 941px"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        {zones.map(zone => (
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
