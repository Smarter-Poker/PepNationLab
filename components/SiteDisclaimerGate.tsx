'use client';

import type { ReactNode } from 'react';

/**
 * Site-Entry Acknowledgment -- Passthrough (2026-07-12).
 *
 * The full-screen Research-Only acknowledgment used to be painted on top of
 * the FIRST page any visitor hit (every route except "/" and "/peptides").
 * On an agent QR scan that meant a wall of legal text over a half-loaded
 * storefront -- it read as a broken link / dead site. Per Dan's direction the
 * on-arrival overlay is removed: a QR scan or cold link now opens straight to
 * a clean, fully rendered page.
 *
 * The Research-Only acknowledgment is NOT weakened -- it is still enforced,
 * independently, at every point where it legally matters:
 *   - Sign-up: three required checkboxes (records layer 'registration').
 *   - Add-to-cart: blocking modal in CartContext (records layer 'add_to_cart').
 *   - Checkout: three required checkboxes + /api/orders hard-refuses any order
 *     missing the acknowledgment (records layer 'checkout').
 *   - Landing page "Continue As Guest": app/HomeClient.tsx shows the same gate
 *     before a guest enters the store (records layer 'site_entry').
 *
 * This component is kept as a transparent passthrough (rather than deleted) so
 * the on-arrival gate can be reinstated in a single file if it is ever needed.
 */
export default function SiteDisclaimerGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
