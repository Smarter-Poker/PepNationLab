/**
 * Carrier detection for agent-pasted tracking numbers.
 *
 * Agents now buy their own labels (recommended tool: Pirate Ship) and paste
 * the tracking number back into the portal. The platform EasyPost account is
 * used ONLY to subscribe a tracker for buyer-facing tracking, and EasyPost
 * needs a carrier string - so we infer it from the tracking-number shape.
 *
 * Returned values are the exact EasyPost carrier identifiers.
 *
 * Rule order matters: the UPS and USPS shapes are tested BEFORE the generic
 * digit-count FedEx rules so a 22-digit USPS IMpb number (92/93/94/95 prefix)
 * is never misread as FedEx.
 */

export type DetectedCarrier = 'USPS' | 'UPS' | 'FedEx' | 'DHLExpress';

export const VALID_CARRIERS: readonly DetectedCarrier[] = ['USPS', 'UPS', 'FedEx', 'DHLExpress'];

/** Trim, remove internal whitespace, and uppercase a raw tracking number. */
export function normalizeTracking(raw: string): string {
  return String(raw ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

export function detectCarrier(tracking: string): DetectedCarrier | null {
  const t = normalizeTracking(tracking);
  if (!t) return null;

  // UPS: 1Z + 16 alphanumerics.
  if (/^1Z[0-9A-Z]{16}$/.test(t)) return 'UPS';

  // USPS international / express (S10): two letters + 9 digits + US.
  if (/^[A-Z]{2}\d{9}US$/.test(t)) return 'USPS';

  // USPS IMpb: 92/93/94/95 prefix, 22-26 digits total.
  if (/^(9[2345])\d{20,24}$/.test(t)) return 'USPS';

  // DHL Express: 10 digits.
  if (/^\d{10}$/.test(t)) return 'DHLExpress';

  // FedEx Express (12) / Ground (15).
  if (/^\d{12}$|^\d{15}$/.test(t)) return 'FedEx';

  // FedEx Ground SSCC-ish long forms (20-22 digits, non-USPS prefix).
  if (/^\d{20,22}$/.test(t)) return 'FedEx';

  return null;
}
