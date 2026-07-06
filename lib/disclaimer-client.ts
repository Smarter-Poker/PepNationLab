'use client';

// Shared Client-Side Helpers For The Layer-1 (Site Entry) Disclaimer.
// Used By Both SiteDisclaimerGate (Route-Level Gate) And The Landing Page
// (Click-Intercept Gate) So Acceptance Is Recorded Once Under One Key.

const DISCLAIMER_VERSION = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';

export const DISCLAIMER_STORAGE_KEY = `pnl_disclaimer_${DISCLAIMER_VERSION}`;

export function isDisclaimerAccepted(): boolean {
  try {
    return localStorage.getItem(DISCLAIMER_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function recordDisclaimerAcceptance(): void {
  try {
    localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
  } catch {
    // Storage May Be Unavailable (Private Mode); The Compliance Log Below Still Fires.
  }
  // Best-Effort Compliance Log; Failure Must Not Block Site Entry.
  // The 3-Checkbox DisclaimerGate Enforces 21+ Research-Only No-Human-Use
  // Confirmation Before This Fires, So We Record Both Bits Here.
  fetch('/api/disclaimer-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layer: 'site_entry', age_verified: true, verified_age: 21 }),
  }).catch(() => { /* Logging Is Non-Blocking */ });
}
