/**
 * Payment-method contract shared by checkout (client), the orders route,
 * and every admin/agent surface that accepts a payment method.
 *
 * Derives the zod enum from the canonical slug list in
 * lib/payment-method-labels.ts so the validation layer and the display
 * layer can never drift again (they previously did: the label map was
 * missing 'varo' while checkout accepted it).
 */
import { z } from 'zod';
import { PAYMENT_METHOD_SLUGS } from '@/lib/payment-method-labels';

export const PaymentMethodEnum = z.enum(PAYMENT_METHOD_SLUGS);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
