/**
 * PRICING INTEGRITY GUARD
 * 
 * This file is a compile-time CI script that checks lib/pricing.ts and the
 * checkout API to ensure that no AI or developer ever accidentally breaks the
 * recursive chain-aware markup math, or corrupts the house_cost assignment.
 * 
 * It asserts that the dynamic agent markup rules strictly resolve using
 * the V2 detailed recursive chain algorithm.
 */

import { readFileSync, existsSync } from 'node:fs';

const PRICING_LIB = 'lib/pricing.ts';
const CHECKOUT_API = 'app/api/orders/route.ts';

const failures = [];
const fail = (title, detail) => failures.push({ title, detail });

const read = (p) => {
  if (!existsSync(p)) { fail(`${p} is MISSING`, 'This file must exist.'); return null; }
  return readFileSync(p, 'utf8');
};

const stripComments = (src) => src
  .split('\n')
  .filter((l) => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('* ') || t === '*' || t.startsWith('/*') || t.startsWith('*/'));
  })
  .join('\n');

const pricingRaw = read(PRICING_LIB);
const checkoutRaw = read(CHECKOUT_API);

if (pricingRaw) {
  const pricing = stripComments(pricingRaw);
  
  if (!pricing.includes('async function resolveChainAwareV2MarkupDetailed')) {
    fail(
      'Chain-aware markup logic is missing from pricing.ts',
      'The resolveChainAwareV2MarkupDetailed function is critical for traversing\n' +
      'super-agent downlines (like Savage Brands -> Eddie). Never delete it.'
    );
  }

  if (!pricing.includes('chainFactor = hopMarkups.reduce((acc, m) => acc * (1 + m / 100), 1)')) {
    fail(
      'Hop markup compounding logic is missing or broken',
      'The math must strictly compound using: (acc, m) => acc * (1 + m / 100).'
    );
  }
}

if (checkoutRaw) {
  const checkout = stripComments(checkoutRaw);

  if (!checkout.includes('houseCost = dbProduct.house_cost != null ? Number(dbProduct.house_cost) : Number(dbProduct.base_cost);')) {
    fail(
      'house_cost assignment is missing or broken in checkout',
      'The checkout must explicitly pull dbProduct.house_cost as the True COG,\n' +
      'falling back to base_cost only if missing. Never assign topOfChainCosts to this.'
    );
  }
}

if (failures.length === 0) {
  console.log('pricing-integrity-guard: OK (chain-aware math invariants hold)');
  process.exit(0);
}

console.error('\n✖ pricing-integrity-guard FAILED — ' + failures.length + ' invariant(s) violated\n');
for (const f of failures) {
  console.error('  • ' + f.title);
  for (const l of f.detail.split('\n')) console.error('      ' + l);
  console.error('');
}
console.error('These protect the platform pricing ledger and margin accuracy.');
console.error('Fix the code -- do not weaken the guard.\n');
process.exit(1);
