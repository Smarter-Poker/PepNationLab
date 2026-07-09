#!/usr/bin/env node
/**
 * Pricing / money-math validator.
 *
 * The pricing engine (tier multipliers -> agent cost -> retail price) had zero
 * automated coverage. This script asserts the money invariants documented in
 * CLAUDE.md against the LIVE database. It is read-only: it never writes.
 *
 * Invariants checked
 *   1. house_tiers.markup === pricing_tiers.multiplier - 1  (tier_N <-> level N)
 *   2. Every active agent / super_agent has a tier assigned.
 *      Without a tier there is no multiplier, so agent cost -- and therefore
 *      weekly COGS billing -- is undefined for that agent.
 *   3. Agent storefronts:  retail = base_cost * tier_multiplier * (1 + margin/100)
 *      (product_tier_overrides.custom_multiplier wins over the tier multiplier)
 *   4. No agent storefront row sells at or below the agent's own cost.
 *   5. Admin/house storefront: the admin is billed COGS (base_cost), so the tier
 *      multiplier does NOT apply.  retail = base_cost * (1 + margin/100)
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/validate-pricing.mjs
 *
 * Exits non-zero if any invariant is violated, so it can gate a deploy or run
 * on a schedule.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const EPSILON = 0.02; // cents of float tolerance

async function table(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

const num = (v) => (v === null || v === undefined ? null : Number(v));

const [products, tiers, houseTiers, overrides, profiles, agentProducts] = await Promise.all([
  table('products?select=id,name,base_cost,is_active&is_active=eq.true&limit=5000'),
  table('pricing_tiers?select=tier_name,multiplier'),
  table('house_tiers?select=level,markup'),
  table('product_tier_overrides?select=product_id,tier_name,custom_multiplier&limit=5000'),
  table('profiles?select=id,username,role,tier&limit=5000'),
  table('agent_products?select=id,agent_id,product_id,retail_price,margin_percent&limit=10000'),
]);

const productById = new Map(products.map((p) => [p.id, p]));
const profileById = new Map(profiles.map((p) => [p.id, p]));
const multiplierByTier = new Map(tiers.map((t) => [t.tier_name, num(t.multiplier)]));
const overrideByKey = new Map(overrides.map((o) => [`${o.product_id}|${o.tier_name}`, num(o.custom_multiplier)]));
const markupByLevel = new Map(houseTiers.map((h) => [Number(h.level), num(h.markup)]));

const failures = [];
const pass = (msg) => console.log(`PASS  ${msg}`);
const fail = (msg) => { failures.push(msg); console.log(`FAIL  ${msg}`); };

// -- 1. tier multiplier <-> house markup lockstep --------------------------
for (const t of tiers) {
  const level = Number(String(t.tier_name).replace(/\D/g, ''));
  const markup = markupByLevel.get(level);
  const expected = num(t.multiplier) - 1;
  if (markup === undefined || markup === null) {
    fail(`house_tiers has no row for level ${level} (tier ${t.tier_name})`);
  } else if (Math.abs(markup - expected) > 1e-4) {
    fail(`lockstep: ${t.tier_name} multiplier ${t.multiplier} implies markup ${expected}, house_tiers has ${markup}`);
  }
}
if (!failures.length) pass(`tier multipliers and house markups are in lockstep (${tiers.length} tiers)`);

// -- 2. every active agent has a tier --------------------------------------
const tierlessAgents = profiles.filter(
  (p) => (p.role === 'agent' || p.role === 'super_agent') && !p.tier,
);
if (tierlessAgents.length) {
  fail(
    `${tierlessAgents.length} agent(s) have no tier -> agent cost + COGS billing undefined: ` +
      tierlessAgents.map((a) => a.username ?? a.id).join(', '),
  );
} else {
  pass('every active agent / super_agent has a tier assigned');
}

// -- 3/4/5. per-storefront retail price math --------------------------------
let checked = 0;
const mismatches = [];
const belowCost = [];
const unresolved = [];

for (const ap of agentProducts) {
  const product = productById.get(ap.product_id);
  const owner = profileById.get(ap.agent_id);
  if (!product || !owner) continue; // inactive product or orphan; covered elsewhere

  const base = num(product.base_cost);
  const margin = num(ap.margin_percent);
  const retail = num(ap.retail_price);
  if (base === null || margin === null || retail === null) {
    unresolved.push(`${owner.username}/${product.name}: null base_cost/margin/retail`);
    continue;
  }

  const isAdminStore = owner.role === 'admin';
  // The admin is billed COGS, so no tier multiplier applies to the house store.
  let multiplier = 1;
  if (!isAdminStore) {
    const override = overrideByKey.get(`${ap.product_id}|${owner.tier}`);
    const tierMult = override ?? multiplierByTier.get(owner.tier);
    if (tierMult === undefined || tierMult === null) {
      unresolved.push(`${owner.username}/${product.name}: no multiplier for tier ${owner.tier}`);
      continue;
    }
    multiplier = tierMult;
  }

  const agentCost = base * multiplier;
  const expected = agentCost * (1 + margin / 100);
  checked++;

  if (Math.abs(retail - expected) > EPSILON) {
    mismatches.push(
      `${owner.username}/${product.name}: retail ${retail.toFixed(2)} != expected ${expected.toFixed(2)} ` +
        `(base ${base} x mult ${multiplier} x margin ${margin}%)`,
    );
  }
  if (!isAdminStore && retail <= agentCost) {
    belowCost.push(
      `${owner.username}/${product.name}: retail ${retail.toFixed(2)} <= agent cost ${agentCost.toFixed(2)} (SELLING AT A LOSS)`,
    );
  }
}

if (unresolved.length) {
  fail(`${unresolved.length} storefront row(s) could not be priced:`);
  unresolved.slice(0, 10).forEach((m) => console.log(`        ${m}`));
} else {
  pass('every storefront row resolves a cost');
}

if (belowCost.length) {
  fail(`${belowCost.length} storefront row(s) sell AT OR BELOW agent cost:`);
  belowCost.slice(0, 10).forEach((m) => console.log(`        ${m}`));
} else {
  pass('no storefront row sells at or below agent cost');
}

if (mismatches.length) {
  fail(`${mismatches.length} storefront row(s) do not match the pricing formula:`);
  mismatches.slice(0, 10).forEach((m) => console.log(`        ${m}`));
} else {
  pass(`all ${checked} storefront prices match the pricing formula`);
}

console.log(`\nChecked ${checked} storefront prices across ${profiles.length} profiles and ${products.length} active products.`);

if (failures.length) {
  console.error(`\nPRICING VALIDATION FAILED: ${failures.length} invariant(s) violated.`);
  process.exit(1);
}
console.log('\nAll pricing invariants hold.');
