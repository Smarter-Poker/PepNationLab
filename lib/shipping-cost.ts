/**
 * lib/shipping-cost.ts
 *
 * Flat regional shipping. Pep Nation fulfills and ships EVERY order, so the
 * buyer pays one flat rate determined solely by the destination state:
 *
 *   $20  Midwest + inland
 *   $25  East Coast + West Coast
 *   $40  Alaska, Hawaii, and US territories (non-contiguous)
 *   $0   Agent pickup / local delivery through a representative
 *
 * There are no weight tiers, carrier upcharges, handling fees, or live carrier
 * quotes. The rate a buyer sees at checkout is exactly what the order is
 * charged, because both read this same table.
 *
 * These helpers are pure and safe to import from client components.
 */

/**
 * 'standard' is the only paid option Pep Nation sells today. 'fedex' and 'usps'
 * are retained ONLY so historical orders (and any client that still posts the
 * old value) keep type-checking and price identically to 'standard' -- they no
 * longer represent a buyer-selectable carrier.
 */
export type ShippingOption = 'standard' | 'fedex' | 'usps' | 'agent_pickup';

export type ShippingZone = 'midwest' | 'coastal' | 'noncontiguous';

/** Flat rate in USD per zone. Single source of truth for checkout + orders. */
export const SHIPPING_RATES: Record<ShippingZone, number> = {
  midwest: 20,
  coastal: 25,
  noncontiguous: 40,
};

/**
 * East Coast + West Coast -> $25. New England is included whole (VT is
 * landlocked but ships as Northeast), as are PA and DC, which sit on the
 * eastern corridor in every practical sense.
 */
const COASTAL_STATES = new Set([
  // East Coast
  'ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC',
  'VA', 'NC', 'SC', 'GA', 'FL',
  // West Coast
  'CA', 'OR', 'WA',
]);

/** Alaska, Hawaii and the territories -> $40. Freight off the mainland. */
const NONCONTIGUOUS_STATES = new Set([
  'AK', 'HI', 'PR', 'VI', 'GU', 'AS', 'MP',
]);

/**
 * Unknown / not-yet-entered destination. Defaults to the coastal rate so a
 * partially filled checkout never quotes LESS than the buyer will be charged
 * once the address is complete.
 */
const DEFAULT_ZONE: ShippingZone = 'coastal';

/**
 * Resolve a destination state (2-letter code, case/whitespace tolerant) to its
 * shipping zone. Everything that is not coastal or non-contiguous is midwest /
 * inland -- so every US destination resolves, and none ship free by accident.
 */
export function getShippingZone(state: string | null | undefined): ShippingZone {
  const code = String(state ?? '').trim().toUpperCase();
  if (!code) return DEFAULT_ZONE;
  if (NONCONTIGUOUS_STATES.has(code)) return 'noncontiguous';
  if (COASTAL_STATES.has(code)) return 'coastal';
  return 'midwest';
}

/**
 * The shipping charge for an order.
 *
 * @param option            Fulfillment choice. 'agent_pickup' is always free.
 * @param destinationState  2-letter state code of the shipping address.
 */
export function calculateShippingCost(
  option: ShippingOption,
  destinationState: string | null | undefined,
): number {
  if (option === 'agent_pickup') return 0;
  return SHIPPING_RATES[getShippingZone(destinationState)];
}

/** Human label for the zone, for checkout copy and receipts. */
export function getShippingZoneLabel(zone: ShippingZone): string {
  if (zone === 'coastal') return 'East / West Coast';
  if (zone === 'noncontiguous') return 'Alaska, Hawaii & Territories';
  return 'Midwest & Inland';
}

export function getCarrierName(option: ShippingOption): string {
  if (option === 'agent_pickup') return 'Agent Pickup';
  // Legacy values from orders placed before Pep Nation took over fulfillment.
  if (option === 'fedex') return 'FedEx / UPS';
  if (option === 'usps') return 'USPS / China Post';
  return 'Pep Nation Standard Shipping';
}

export function getFulfillmentMethod(option: ShippingOption): 'ship' | 'agent_pickup' {
  if (option === 'agent_pickup') return 'agent_pickup';
  return 'ship';
}
