import fs from 'fs';
const fails = [];
const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
function once(s, anchor, label) {
  const n = s.split(anchor).length - 1;
  if (n !== 1) { fails.push(`${label}: anchor found ${n}x (need 1)`); return false; }
  return true;
}

// 1. orders.ts -- import + house free shipping
let O = read('app/api/orders/route.ts');
const oi = "import { calculateShippingCost, getCarrierName } from '@/lib/shipping-cost';\n";
if (once(O, oi, 'orders:import')) O = O.replace(oi, oi + "import { DEFAULT_STORE_SLUG } from '@/lib/default-store';\n");
const og = "    const grossTotal = Math.round((Math.max(0, subtotal - discountAmount) + shippingCost) * 100) / 100;";
if (once(O, og, 'orders:freeship')) O = O.replace(og,
  "    // House-store free shipping: $100+ orders on the admin/house storefront\n" +
  "    // (researchstore) ship free. Placed before grossTotal so total, stored\n" +
  "    // shipping_cost, and downstream COGS agree. Pickup is already $0.\n" +
  "    if (agentSlug === DEFAULT_STORE_SLUG && actualShippingOption !== 'agent_pickup' && subtotal >= 100) {\n" +
  "      shippingCost = 0;\n" +
  "    }\n\n" + og);
write('app/api/orders/route.ts', O);

// 2. checkout display
let C = read('app/checkout/CheckoutForm.tsx');
const ca = "const shippingCost = calculateShippingCost();";
if (once(C, ca, 'checkout:display')) C = C.replace(ca,
  "const shippingCost = (agentSlug === 'researchstore' && cartSubtotal >= 100) ? 0 : calculateShippingCost();");
write('app/checkout/CheckoutForm.tsx', C);

// 3. page.tsx -- fetch market_avg_price
let P = read('app/[agentSlug]/page.tsx');
const pa = "          base_cost,\n          compound_slug\n        )";
if (once(P, pa, 'page:query')) P = P.replace(pa, "          base_cost,\n          market_avg_price,\n          compound_slug\n        )");
write('app/[agentSlug]/page.tsx', P);

// 4. grid -- compute + strikethrough (admin store only)
let G = read('components/AgentStorefrontGrid.tsx');
const gc = "const displayPrice = isBW ? perVialDisplay * 10 : perVialDisplay;";
if (once(G, gc, 'grid:compute')) G = G.replace(gc, gc +
  "\n                      const _marketAvgVial = Number((defaultV as any).products?.market_avg_price) || 0;" +
  "\n                      const _marketAvgDisplay = isBW ? _marketAvgVial * 10 : _marketAvgVial;" +
  "\n                      const _showMarketAvg = agentSlug === 'researchstore' && _marketAvgDisplay > displayPrice;");
const marker = "{displaySizeText} &nbsp;${displayPrice.toFixed(2)}";
if (once(G, marker, 'grid:render')) {
  const spanOpen = '<span className="sf-product-price-nickel" style={{';
  const mi = G.indexOf(marker); const si = G.lastIndexOf(spanOpen, mi);
  if (si < 0) fails.push('grid:render span-open not found');
  else {
    const ins = "{_showMarketAvg && (\n                            <span style={{ fontSize: '0.95rem', color: 'var(--grey-500)', textDecoration: 'line-through', fontWeight: 600 }}>\n" +
      "                              ${_marketAvgDisplay.toFixed(2)}\n                            </span>\n                          )}\n                          ";
    G = G.slice(0, si) + ins + G.slice(si);
  }
}
write('components/AgentStorefrontGrid.tsx', G);

// 5. layout -- mount banner
let L = read('app/layout.tsx');
const li = 'import FlashSaleBanner from "@/components/FlashSaleBanner";';
if (once(L, li, 'layout:import')) L = L.replace(li, li + '\nimport FreeShippingBanner from "@/components/FreeShippingBanner";');
const lm = '<FlashSaleBanner />';
if (once(L, lm, 'layout:mount')) L = L.replace(lm, lm + '\n          <FreeShippingBanner />');
write('app/layout.tsx', L);

// 6. new FreeShippingBanner component (house store only)
const banner = `'use client';
import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';

/**
 * House/admin store free-shipping promo. Shows only on the house storefront
 * (researchstore). The offer is enforced server-side in /api/orders and the
 * checkout summary reflects $0 shipping once the $100 threshold is met.
 */
export default function FreeShippingBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(window.location.pathname === '/researchstore'); }, []);
  if (!show) return null;
  return (
    <div role="status" data-nosnippet style={{ background: 'linear-gradient(90deg,#0A1018 0%,#12303a 100%)', color: '#EAF7F6', padding: '7px 16px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #143b44' }}>
      <Truck size={15} aria-hidden="true" />
      <span>Free Shipping On All Orders $100+</span>
    </div>
  );
}
`;
write('components/FreeShippingBanner.tsx', banner);

if (fails.length) { console.error('APPLY FAILED:\n' + fails.map(f => ' - ' + f).join('\n')); process.exit(1); }
console.log('APPLY OK: 8 edits + FreeShippingBanner.tsx written');
