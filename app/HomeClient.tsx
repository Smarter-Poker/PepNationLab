'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import DisclaimerGate from '@/components/DisclaimerGate';
import { isDisclaimerAccepted, recordDisclaimerAcceptance } from '@/lib/disclaimer-client';

// Public Landing Page -- Renders The Supplied Artwork Exactly As Provided,
// With Invisible Click Zones Layered On Top (Same Pattern As Peptide 101).
// Image Is 941x1672; All Hitboxes Are Percentages Of That Canvas.
//
// Flow: The Landing Artwork Is ALWAYS The First Thing A Visitor Sees.
// Clicking ANY Zone Checks The Layer-1 Disclaimer; First-Time Visitors
// Get The Mandatory Research-Only Acknowledgment Before Being Taken To
// Their Destination (Log In, Create Account, Guest, Etc.).

type Zone = {
  href: string;
  label: string;
  top: string;
  left: string;
  width: string;
  height: string;
};

const ZONES: Zone[] = [
  // Right-Side Hexagon Badges
  { href: '/find-a-peptide', label: 'Discover', top: '12.56%', left: '79.17%', width: '18.4%', height: '7.77%' },
  { href: '/research', label: 'Research', top: '21.83%', left: '79.17%', width: '18.4%', height: '8.07%' },
  { href: '/peptide-101', label: 'Learn', top: '31.10%', left: '79.17%', width: '18.4%', height: '8.07%' },
  { href: `/${DEFAULT_STORE_SLUG}`, label: 'Transform', top: '40.37%', left: '79.17%', width: '18.4%', height: '8.37%' },
  // Primary Action Buttons
  { href: '/login', label: 'Log In', top: '71.29%', left: '20.72%', width: '58.98%', height: '3.59%' },
  { href: '/signup', label: 'Create Account', top: '76.85%', left: '20.72%', width: '58.98%', height: '3.59%' },
  { href: `/${DEFAULT_STORE_SLUG}`, label: 'Continue As Guest', top: '82.06%', left: '20.72%', width: '58.98%', height: '3.59%' },
  // Footer Compliance Line
  { href: '/disclaimer', label: 'For Research Purposes Only', top: '97.1%', left: '10%', width: '80%', height: '2.4%' },
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
    <div style={{ backgroundColor: '#020617', minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '941px', margin: '0 auto' }}>
        <img
          src="https://ydsaqnnuwyvtyxgvrnys.supabase.co/storage/v1/object/public/storefront-assets/landing/pep-nation-landing.png"
          alt="Pep Nation Peptide 101 Research Academy -- Your Source For Peptide Education And Research"
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
              cursor: 'pointer',
              zIndex: 10,
            }}
          />
        ))}
      </div>
      {pendingHref !== null && <DisclaimerGate onAccept={handleAccept} />}
    </div>
  );
}
