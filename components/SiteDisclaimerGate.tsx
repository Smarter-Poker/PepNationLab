'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import DisclaimerGate from './DisclaimerGate';
import { isDisclaimerAccepted, recordDisclaimerAcceptance } from '@/lib/disclaimer-client';

/**
 * Layer 1 of the mandatory 4-layer research-only disclaimer.
 *
 * Wraps the entire site so the Site Entry acknowledgment appears on ANY
 * first route a visitor lands on. Acceptance is recorded in localStorage
 * under a version-scoped key so bumping the disclaimer version forces
 * re-acknowledgment.
 *
 * EXCEPTION: The Public Landing Page ("/") Renders Without The Gate.
 * First-Time Visitors Must See The Landing Artwork First; The Landing
 * Page Itself Intercepts Every Button Click And Shows This Same
 * Disclaimer Before Navigating Anywhere (See app/page.tsx).
 */
export default function SiteDisclaimerGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccepted(isDisclaimerAccepted());
    setReady(true);
  }, [pathname]);

  const handleAccept = () => {
    recordDisclaimerAcceptance();
    setAccepted(true);
  };

  // The Landing Page Is Always Visible -- Its Click Zones Enforce The Gate.
  // We also bypass the gate for City Landing Pages so users can read the SEO content
  // before being asked to accept the compliance agreement upon further navigation.
  if (pathname === '/' || pathname.startsWith('/peptides')) return <>{children}</>;

  // Block render until we've checked localStorage (one RAF after mount).
  // This prevents a brief flash of site content before the disclaimer gate appears
  // on a first-visit or after a version bump forces re-acknowledgment.
  if (!ready) return null;

  // Once ready: if accepted, show children; otherwise show the gate (no children behind it).
  if (!accepted) return <DisclaimerGate onAccept={handleAccept} />;

  return <>{children}</>;
}
