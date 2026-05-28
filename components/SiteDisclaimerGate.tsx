'use client';

import { useState, useEffect } from 'react';
import DisclaimerGate from './DisclaimerGate';

const DISCLAIMER_VERSION = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';
const STORAGE_KEY = `pnl_disclaimer_${DISCLAIMER_VERSION}`;

/**
 * Layer 1 of the mandatory 4-layer research-only disclaimer.
 *
 * Wraps the entire site so the Site Entry acknowledgment appears on ANY
 * first route a visitor lands on — not just the homepage. Acceptance is
 * recorded in localStorage under a version-scoped key so bumping the
 * disclaimer version forces re-acknowledgment.
 */
export default function SiteDisclaimerGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccepted(localStorage.getItem(STORAGE_KEY) === 'true');
    setReady(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setAccepted(true);
    // Best-effort compliance log; failure must not block site entry.
    fetch('/api/disclaimer-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layer: 'site_entry' }),
    }).catch(() => { /* logging is non-blocking */ });
  };

  return (
    <>
      {children}
      {ready && !accepted && <DisclaimerGate onAccept={handleAccept} />}
    </>
  );
}
