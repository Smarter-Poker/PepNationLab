#!/usr/bin/env node
/**
 * Pricing / money-math validator.
 *
 * The pricing engine (cost basis -> agent cost -> retail price) had zero
 * automated coverage. This script asserts the money invariants against the LIVE
 * database. It is read-only and never writes.
 *
 * IMPORTANT: the invariants are evaluated INSIDE Postgres, by
 * public.fn_validate_pricing() (see supabase/migrations/*_pricing_guardrails.sql).
 * That function calls the database's own fn_resolve_house_tier_level(), which is
 * dynamic (30-day volume, grace periods, locked/fixed tier overrides). Any
 * re-implementation of that resolver in JavaScript would silently drift from
 * production, so we deliberately do NOT re-implement it here.
 *
 * Invariants asserted:
 *   RETAIL_MISMATCH             retail != base_cost * (1 + effective_markup) * (1 + margin/100)
 *   AT_OR_BELOW_COST            retail <= the agent's own wholesale cost (selling at a loss)
 *   TIER_MARKUP_LOCKSTEP_BROKEN house_tiers.markup != pricing_tiers.multiplier - 1
 *
 * Banned products are excluded: they cannot be sold, so a stale price on a
 * banned row is not a live defect.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/validate-pricing.mjs
 *
 * Exits non-zero when any invariant is violated, so it can gate a deploy or run
 * on a schedule.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const res = await fetch(`${URL}/rest/v1/rpc/fn_validate_pricing`, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
});

if (!res.ok) {
  console.error(`fn_validate_pricing failed: ${res.status} ${await res.text().catch(() => '')}`);
  console.error('Is the pricing_guardrails migration applied to this project?');
  process.exit(2);
}

const violations = await res.json();

if (!Array.isArray(violations)) {
  console.error('Unexpected response shape from fn_validate_pricing.');
  process.exit(2);
}

if (violations.length === 0) {
  console.log('PASS  retail prices match the pricing formula');
  console.log('PASS  no storefront sells at or below agent cost');
  console.log('PASS  tier multipliers and house markups are in lockstep');
  console.log('\nAll pricing invariants hold.');
  process.exit(0);
}

// Group and report.
const byKind = new Map();
for (const v of violations) {
  if (!byKind.has(v.violation)) byKind.set(v.violation, []);
  byKind.get(v.violation).push(v);
}

const money = (n) => (n === null || n === undefined ? '-' : Number(n).toFixed(2));

for (const [kind, rows] of byKind) {
  console.log(`\nFAIL  ${kind}: ${rows.length} row(s)`);
  for (const r of rows.slice(0, 20)) {
    if (kind === 'TIER_MARKUP_LOCKSTEP_BROKEN') {
      console.log(
        `        ${r.product_name}: multiplier ${money(r.effective_markup)} implies markup ` +
          `${money(r.expected_value)}, house_tiers has ${money(r.actual_retail)}`,
      );
    } else {
      console.log(
        `        ${r.agent_username}/${r.product_name}: retail ${money(r.actual_retail)} vs ` +
          `expected ${money(r.expected_value)}  (base ${money(r.base_cost)} x ` +
          `1+${money(r.effective_markup)} markup x ${money(r.margin_percent)}% margin)`,
      );
    }
  }
  if (rows.length > 20) console.log(`        ... and ${rows.length - 20} more`);
}

console.error(`\nPRICING VALIDATION FAILED: ${violations.length} violation(s).`);
process.exit(1);
