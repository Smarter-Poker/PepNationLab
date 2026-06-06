/**
 * Shipping calculation and helpers based on weight in grams.
 * Convert weight in ounces (oz) to grams (g) where 1 oz = 28.3495 g.
 */

export type ShippingOption = 'fedex' | 'usps' | 'agent_pickup';

export function calculateShippingCost(option: ShippingOption, weightOz: number): number {
  if (option === 'agent_pickup') {
    return 0;
  }
  // Convert ounces to grams
  const weightG = weightOz * 28.3495;
  const baseRate = option === 'fedex' ? 80 : 40;
  
  if (weightG <= 500) {
    return baseRate;
  }
  
  const additionalWeight = weightG - 500;
  const additionalTiers = Math.ceil(additionalWeight / 500);
  return baseRate + additionalTiers * 10;
}

export function getCarrierName(option: ShippingOption): string {
  if (option === 'fedex') return 'FedEx / UPS';
  if (option === 'usps') return 'USPS / China Post';
  return 'Agent Pickup';
}

export function getFulfillmentMethod(option: ShippingOption): 'ship' | 'agent_pickup' {
  if (option === 'agent_pickup') return 'agent_pickup';
  return 'ship';
}
