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
 * SEO-CRITICAL RENDERING CONTRACT (do not regress):
 * Children are ALWAYS rendered — on the server and on the client. The gate
 * is a fixed full-screen overlay (`.modal-overlay`, z-index 1000, opaque
 * backdrop) painted ON TOP of the page after hydration when acceptance has
 * not been recorded. The previous implementation returned `null` until the
 * localStorage check completed, which meant every server-rendered page
 * (city landing pages, the research library, everything) shipped an EMPTY
 * <body> to crawlers. Search engines and AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot) do not execute JavaScript or accept the gate, so the site
 * was invisible to them. Rendering content beneath a legally required
 * interstitial keeps the compliance gate fully intact for human visitors
 * (the overlay blocks all interaction and scrolling until accepted) while
 * letting crawlers index the page. Google explicitly exempts legally
 * required interstitials from its intrusive-interstitial policy.
 *
 * EXCEPTION: The Public Landing Page ("/") Renders Without The Gate.
 * First-Time Visitors Must See The Landing Artwork First; The Landing
 * Page Itself Intercepts Every Button Click And Shows This Same
 * Disclaimer Before Navigating Anywhere (See app/page.tsx).
 *
 * EXCEPTION: City Landing Pages ("/peptides...") Render Without The Gate
 * So Visitors Can Read The Local SEO Content First; The Gate Appears On
 * Any Further Navigation Into The Platform.
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

  const exempt = pathname === '/' || pathname.startsWith('/peptides');
  const showGate = ready && !accepted && !exempt;

  // Lock body scroll while the gate overlay is up so the page behind it
  // cannot be scrolled or interacted with until the acknowledgment.
  useEffect(() => {
    if (!showGate) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showGate]);

  const handleAccept = () => {
    recordDisclaimerAcceptance();
    setAccepted(true);
  };

  return (
    <>
      {children}
      {showGate && <DisclaimerGate onAccept={handleAccept} />}
    </>
  );
}
