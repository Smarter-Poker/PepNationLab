import type { SupabaseClient } from '@supabase/supabase-js';

export interface TaxQuoteInput {
  buyerId?: string | null;
  subtotal: number;
  shipping: number;
  shippingState?: string | null;
}

export interface TaxQuote {
  taxableAmount: number;
  rate: number;
  taxAmount: number;
  jurisdiction: string | null;
  exempt: boolean;
  exemptionId: string | null;
}

const ZERO_QUOTE: TaxQuote = {
  taxableAmount: 0,
  rate: 0,
  taxAmount: 0,
  jurisdiction: null,
  exempt: false,
  exemptionId: null,
};

/**
 * Compute a sales-tax quote for a given subtotal, shipping cost, and
 * shipping state. Looks up the active tax_rules row for the destination
 * state and applies the buyer's approved exemption (if any).
 *
 * Defaults to zero tax when no state is provided, when no active rule
 * matches, or when the rule's base_rate is zero — never blocks checkout.
 */
export async function computeTaxQuote(
  supabase: SupabaseClient,
  input: TaxQuoteInput
): Promise<TaxQuote> {
  const subtotal = Number.isFinite(input.subtotal) ? Math.max(0, Number(input.subtotal)) : 0;
  const shipping = Number.isFinite(input.shipping) ? Math.max(0, Number(input.shipping)) : 0;
  const stateCode = (input.shippingState || '').toString().trim().toUpperCase();

  if (!stateCode || stateCode.length !== 2) {
    return ZERO_QUOTE;
  }

  const { data: rule } = await supabase
    .from('tax_rules')
    .select('id, jurisdiction, state_code, base_rate, applies_to, shipping_taxable, is_active')
    .eq('state_code', stateCode)
    .eq('is_active', true)
    .maybeSingle();

  if (!rule) {
    return ZERO_QUOTE;
  }

  const jurisdiction = rule.jurisdiction || `US-${stateCode}`;
  const baseRate = Math.max(0, Math.min(0.5, Number(rule.base_rate) || 0));

  // Exemption check — only meaningful if a buyer id is supplied.
  if (input.buyerId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: exemption } = await supabase
      .from('tax_exemptions')
      .select('id, status, expires_at, state_code')
      .eq('user_id', input.buyerId)
      .eq('state_code', stateCode)
      .eq('status', 'approved')
      .maybeSingle();

    if (exemption) {
      const notExpired = !exemption.expires_at || exemption.expires_at >= today;
      if (notExpired) {
        return {
          taxableAmount: 0,
          rate: baseRate,
          taxAmount: 0,
          jurisdiction,
          exempt: true,
          exemptionId: exemption.id,
        };
      }
    }
  }

  let taxableAmount = 0;
  switch (rule.applies_to) {
    case 'shipping_only':
      taxableAmount = shipping;
      break;
    case 'subtotal_plus_shipping':
      taxableAmount = subtotal + shipping;
      break;
    case 'subtotal':
    default:
      taxableAmount = subtotal + (rule.shipping_taxable ? shipping : 0);
      break;
  }

  taxableAmount = Math.max(0, taxableAmount);
  const taxAmount = Math.round(taxableAmount * baseRate * 100) / 100;

  return {
    taxableAmount,
    rate: baseRate,
    taxAmount,
    jurisdiction,
    exempt: false,
    exemptionId: null,
  };
}
