'use client';

import { useState, useEffect } from 'react';
import DisclaimerGate from './DisclaimerGate';

/**
 * Layer 1 of the mandatory 4-layer research-only disclaimer.
 *
 * Wraps the entire site so the Site Entry acknowledgment appears on ANY
 * first route a visitor lands on — not just the homepage. Acceptance is
 * recorded in localStorage so it is shown once per browser.
 */
export default function SiteDisclaimerGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccepted(localStorage.getItem('pnl_disclaimer_v1') === 'true');
    setReady(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('pnl_disclaimer_v1', 'true');
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
