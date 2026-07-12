/**
 * Canonical payment-method enum + label map (R26).
 *
 * `profiles.default_payment_method` and `orders.payment_method` both accept
 * any of the 10 slugs below (CHECK-constrained at the DB level). Until this
 * file existed, every order surface (researcher list, agent list, admin list,
 * and the order-detail variants) maintained its OWN 4-method dictionary, so
 * orders paid via apple_cash / paypal / google_wallet / wise / chime / varo
 * rendered as raw lowercase slugs ("apple_cash") or worse - admin's screen
 * showed them uppercased ("APPLE_CASH") because the dict was missing.
 *
 * Import this from every consumer so the UI never drifts again.
 */

export type PaymentMethodSlug =
  | 'zelle'
  | 'venmo'
  | 'cashapp'
  | 'apple_pay'
  | 'apple_cash'
  | 'paypal'
  | 'google_wallet'
  | 'wise'
  | 'chime'
  | 'varo';

export const PAYMENT_METHOD_SLUGS = [
  'zelle',
  'venmo',
  'cashapp',
  'apple_pay',
  'apple_cash',
  'paypal',
  'google_wallet',
  'wise',
  'chime',
  'varo',
] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodSlug, string> = {
  zelle: 'Zelle',
  venmo: 'Venmo',
  cashapp: 'Cash App',
  apple_pay: 'Apple Pay',
  apple_cash: 'Apple Cash',
  paypal: 'PayPal',
  google_wallet: 'Google Wallet',
  wise: 'Wise',
  chime: 'Chime',
  varo: 'Varo',
};

/** Safe display: returns the friendly label, or a Title-Cased fallback for an
 *  unknown / null slug instead of letting raw "apple_cash" leak into the UI. */
export function paymentMethodLabel(slug: string | null | undefined): string {
  if (!slug) return 'Not Selected';
  if (slug in PAYMENT_METHOD_LABELS) {
    return PAYMENT_METHOD_LABELS[slug as PaymentMethodSlug];
  }
  // Fallback for any future slug not yet mapped - keep it readable.
  return slug
    .split('_')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
