/**
 * Best-effort carrier detection from a tracking-number prefix/shape.
 *
 * This is a heuristic — there is overlap between USPS and FedEx all-digit
 * formats. Used only for UI display (a badge + a "Track With <Carrier>" link).
 * NEVER use the result to make money/payment decisions.
 */

export type Carrier = 'USPS' | 'UPS' | 'FedEx' | 'DHL' | 'Unknown';

export interface CarrierInfo {
  carrier: Carrier;
  trackingUrl: string | null;
}

const USPS_PREFIXES = ['9407', '9303', '9202', '9270', '9405', '9214', '4209'];
const USPS_LETTER_PREFIXES = ['EM', 'EL', 'EC', 'EE'];
const DHL_LETTER_PREFIXES = ['JD', 'JV', 'L'];

function strip(s: string): string {
  return (s || '').replace(/[\s-]/g, '').toUpperCase();
}

export function detectCarrier(rawTrackingNumber: string | null | undefined): Carrier {
  if (!rawTrackingNumber) return 'Unknown';
  const tn = strip(rawTrackingNumber);
  if (!tn) return 'Unknown';

  // UPS: starts with "1Z"
  if (tn.startsWith('1Z')) return 'UPS';

  // USPS Express Mail letter prefixes (EM/EL/EC/EE) + 9 chars after
  for (const p of USPS_LETTER_PREFIXES) {
    if (tn.startsWith(p) && tn.length >= 11) return 'USPS';
  }

  // DHL letter prefixes (JD/JV/L)
  for (const p of DHL_LETTER_PREFIXES) {
    if (tn.startsWith(p) && /[A-Z]/.test(tn[0])) return 'DHL';
  }

  // USPS numeric prefixes
  for (const p of USPS_PREFIXES) {
    if (tn.startsWith(p)) return 'USPS';
  }

  // All numeric from here on
  if (!/^\d+$/.test(tn)) return 'Unknown';

  // USPS IMpb 20-22 digits
  if (tn.length >= 20 && tn.length <= 22) return 'USPS';

  // FedEx 12 or 15 digit numeric (after USPS prefix check above)
  if (tn.length === 12 || tn.length === 15) return 'FedEx';

  // DHL 10-digit numeric
  if (tn.length === 10) return 'DHL';

  return 'Unknown';
}

export function trackingUrl(carrier: Carrier, trackingNumber: string): string | null {
  const tn = encodeURIComponent(strip(trackingNumber));
  switch (carrier) {
    case 'USPS':
      return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${tn}`;
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${tn}`;
    case 'FedEx':
      return `https://www.fedex.com/fedextrack/?trknbr=${tn}`;
    case 'DHL':
      return `https://www.dhl.com/global-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${tn}`;
    default:
      return null;
  }
}

export function carrierInfo(rawTrackingNumber: string | null | undefined): CarrierInfo {
  const carrier = detectCarrier(rawTrackingNumber);
  const url = carrier !== 'Unknown' && rawTrackingNumber ? trackingUrl(carrier, rawTrackingNumber) : null;
  return { carrier, trackingUrl: url };
}
