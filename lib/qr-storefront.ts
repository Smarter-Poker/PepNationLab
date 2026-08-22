import { generateQrDataUrl } from '@/lib/qr';

/**
 * ONE place that decides what an agent's storefront QR code actually encodes.
 *
 * Every provisioning route used to build this string itself, and they had all
 * drifted apart:
 *
 *   /api/manufacturer/agents   `${APP_URL}/${slug}`                        <- no ref, no utm
 *   /api/admin/agents          `${APP_URL}/${slug}`                        <- no ref, no utm
 *   /api/agent/agents          `${APP_URL}/${slug}?utm_source=qr&...`      <- no ref
 *   /api/agent/promote-subagent`${APP_URL}/${slug}?utm_source=qr&...`      <- no ref
 *   /api/admin/researchers     (promote-to-agent wrote no QR at all)
 *
 * A QR with no `ref` still reaches the storefront, but proxy.ts can only mint
 * a SOFT lock (`k:'url'`) from a bare storefront URL - and a soft lock is
 * replaceable by the next agent's link the visitor touches. The whole point of
 * a printed, physically handed-out QR code is a HARD first-scan-wins lock, which
 * proxy.ts only mints when it sees `?ref=`. So every agent provisioned through
 * the four routes above has been shipping a code that quietly loses attribution
 * the moment the scanner clicks someone else's link.
 *
 * Colour matters as much as the payload. lib/qr.ts defaults to the brand
 * palette - teal modules on a near-black background - which is an INVERTED QR
 * code. Plenty of phone cameras will not decode one. The 40 stored codes were
 * re-rendered black-on-white after that was found in production, so anything
 * generated from here uses the same scanner-safe palette; a pretty code nobody
 * can scan is worth less than a plain one that always works.
 */

export const APP_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com'
).replace(/\/+$/, '');

/**
 * The URL a storefront QR code encodes.
 *
 * `refCode` should be the agent's referral namespace - `profiles.referral_code`
 * when one exists, otherwise `profiles.username`. proxy.ts's resolveRefCode()
 * accepts a referral_code, a username, OR a storefront slug, so falling back to
 * the slug itself still produces a working hard lock rather than no lock.
 */
export function buildStorefrontQrUrl(slug: string, refCode?: string | null): string {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  const ref = String(refCode || cleanSlug || '').trim().toLowerCase();
  const params = new URLSearchParams();
  if (ref) params.set('ref', ref);
  // utm params make scans attributable as offline/QR traffic. UtmCapture
  // ingests and strips them client-side, so they never stick to the URL.
  params.set('utm_source', 'qr');
  params.set('utm_medium', 'offline');
  return `${APP_ORIGIN}/${cleanSlug}?${params.toString()}`;
}

/**
 * Render the storefront QR as a data: URL. Never throws - a failed QR render
 * must not roll back an otherwise-successful account creation, so callers get
 * null and the storefront works without a cached code.
 */
export async function generateStorefrontQr(
  slug: string,
  refCode?: string | null,
): Promise<string | null> {
  try {
    // Scanner-safe palette, deliberately not the brand default. See above.
    return await generateQrDataUrl(buildStorefrontQrUrl(slug, refCode), '#000000', '#FFFFFF');
  } catch (err) {
    console.error('[qr-storefront] QR generation failed for slug', slug, err);
    return null;
  }
}
