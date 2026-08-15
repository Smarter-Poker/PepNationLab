#!/usr/bin/env node
/**
 * checkout-diluent-guard — build-blocking invariant check for the checkout
 * reconstitution estimator (the "BAC water calculator + recommendation").
 *
 * WHY THIS EXISTS
 * This feature has been silently broken three times. Every time, the same
 * shape: an unrelated commit rewrites the diluent lookup, PostgREST answers
 * 400 or hands back the wrong vial size, the client destructures `{ data }`
 * without `error`, and the panel quietly shows a wrong price or nothing at
 * all. Nobody finds out until a customer's order ships with no BAC water.
 *
 * On 2026-08-15 the lookup was fixed at 00:02 and clobbered again at 00:45 by
 * a commit whose subject was about the MESSENGER. That commit went STRAIGHT TO
 * MAIN, so a pull-request gate would never have seen it. This guard therefore
 * runs as `prebuild` -- on every Vercel build, however the code arrived. A
 * violation fails the BUILD, so the regression cannot reach production.
 *
 * Companion: app/api/cron/checkout-guard runs these same concerns against the
 * live database daily. This file is the compile-time half; that one is the
 * runtime half. Keep both.
 *
 * IF YOU ARE AN AGENT AND THIS GUARD JUST FAILED YOUR BUILD: do not delete or
 * weaken the rule. Read the failure text -- it names the exact defect and the
 * correct form. These are load-bearing.
 */

import { readFileSync, existsSync } from 'node:fs';

const CHECKOUT = 'app/checkout/CheckoutForm.tsx';
const CANARY = 'app/api/cron/checkout-guard/route.ts';
const MATH_API = 'app/api/cart/bac-water/route.ts';
const VERCEL = 'vercel.json';

const failures = [];
const fail = (title, detail) => failures.push({ title, detail });

const read = (p) => {
  if (!existsSync(p)) { fail(`${p} is MISSING`, 'This file is part of the reconstitution estimator. It must exist.'); return null; }
  return readFileSync(p, 'utf8');
};

// Strip FULL-LINE comments before pattern matching. The fix commit documents
// the broken forms in comments so the next agent understands them; matching
// those would be a false positive. Only whole-line comments are removed, so
// "https://" inside string literals is never touched.
const stripComments = (src) => src
  .split('\n')
  .filter((l) => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('* ') || t === '*' || t.startsWith('/*') || t.startsWith('*/'));
  })
  .join('\n');

const checkoutRaw = read(CHECKOUT);
const checkout = checkoutRaw ? stripComments(checkoutRaw) : null;

if (checkout) {
  // ---- 1. The two query defects that actually shipped -------------------
  if (/foreignTable/.test(checkout)) {
    fail(
      'CheckoutForm uses `foreignTable`',
      'PostgREST embedded-table filters must use the DOTTED column path.\n' +
      "  BROKEN:  .ilike('name', '%acetic acid%', { foreignTable: 'products' })\n" +
      "           -> .ilike() takes NO options arg, so this filtered\n" +
      "              agent_products.name (which does not exist) and PostgREST\n" +
      "              answered 400 on every store, silently.\n" +
      "  CORRECT: .ilike('products.name', '%acetic acid%')\n" +
      "  For .or() on an embedded table use { referencedTable: 'products' }.");
  }

  // Scoped: a bare `name` filter is legitimate on `products` (that table HAS a
  // name column) and only wrong on `agent_products`. Isolate each
  // .from('agent_products') chain and inspect just that slice.
  for (const m of checkout.matchAll(/\.from\(\s*['"]agent_products['"]\s*\)/g)) {
    const start = m.index ?? 0;
    const rest = checkout.slice(start + 1);
    const nextFrom = rest.search(/\.from\(\s*['"]/);
    const chain = nextFrom === -1 ? rest : rest.slice(0, nextFrom);
    if (/\.(ilike|eq|like)\(\s*['"]name['"]/.test(chain)) {
      fail(
        'An agent_products query filters a bare `name` column',
        'agent_products has no `name` column -- the name lives on the embedded\n' +
        "products row, so PostgREST answers 400 (42703). Use the dotted path:\n" +
        "  .ilike('products.name', '%acetic acid%')\n" +
        'A bare `name` filter on the `products` table itself is fine; this rule\n' +
        'only inspects .from("agent_products") chains.');
    }
  }

  // ---- 2. Canonical identity + correct vial size ------------------------
  if (!checkout.includes('compound_slug.eq.bac-water')) {
    fail(
      'BAC water is no longer resolved by compound_slug',
      'Name matching alone is what broke this twice. compound_slug is the\n' +
      'stable identity; keep it first in the .or() filter, with the name\n' +
      'patterns only as a secondary net for rows missing a slug.');
  }

  // Scoped: other parts of this file legitimately compare unit_size to '10'.
  // Only the agent_products chain that resolves BAC WATER must carry the
  // preference, so isolate that chain and look inside it alone.
  const bacIdx = checkout.indexOf('compound_slug.eq.bac-water');
  if (bacIdx !== -1) {
    const chainStart = checkout.lastIndexOf(".from('agent_products')", bacIdx);
    if (chainStart !== -1) {
      const after = checkout.slice(chainStart + 1);
      const nextFrom = after.search(/\.from\(\s*['"]/);
      const bacChain = nextFrom === -1 ? after : after.slice(0, nextFrom);
      if (!/===\s*['"]10['"]/.test(bacChain)) {
        fail(
          'The 10 mL BAC water vial preference is gone',
          'A `.limit(1)` lookup can return the 3 mL vial, which silently changes\n' +
          'both the recommended volume and the price (11 mL becomes 4x3 mL rather\n' +
          'than 2x10 mL). Fetch several rows and explicitly prefer unit_size 10\n' +
          'inside the agent_products BAC water chain.');
      }
    }
  }

  // ---- 3. Failures must never be swallowed again ------------------------
  if (!/store BAC water lookup failed/.test(checkout)) {
    fail(
      'The BAC water lookup no longer logs its PostgREST error',
      'Destructuring `{ data }` without `error` is precisely how a 400 stayed\n' +
      'invisible for weeks. Keep the `if (err) console.error(...)` line.');
  }

  // ---- 4. House style: no em dashes in the reconstitution copy ----------
  const emDashLines = checkout.split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => line.includes('—') && /BAC Water|Bacteriostatic/i.test(line));
  if (emDashLines.length > 0) {
    fail(
      `Em dash in reconstitution copy (${emDashLines.length} line(s): ${emDashLines.map(e => e.n).join(', ')})`,
      'House style is no em dashes in this UI copy. Use a period, a comma, or\n' +
      'nothing. Note the price is rendered as literal "$" + a JSX expression --\n' +
      'when removing a dash before it, keep the "$".');
  }
}

// ---- 5. Both halves of the safety net must still be wired up ------------
read(MATH_API);
const canary = read(CANARY);
if (canary && !/checkout_guard/.test(canary)) {
  fail(`${CANARY} no longer claims the 'checkout_guard' cron job`,
       'claimCronRun("checkout_guard", ...) is what records the run. Keep it.');
}

const vercel = read(VERCEL);
if (vercel && !vercel.includes('/api/cron/checkout-guard')) {
  fail('vercel.json no longer schedules /api/cron/checkout-guard',
       'Without the schedule the daily runtime canary never fires and this\n' +
       'feature goes back to failing silently in production.');
}

// ---- report -------------------------------------------------------------
if (failures.length === 0) {
  console.log('checkout-diluent-guard: OK (reconstitution estimator invariants hold)');
  process.exit(0);
}

console.error('\n✖ checkout-diluent-guard FAILED — ' + failures.length + ' invariant(s) violated\n');
for (const f of failures) {
  console.error('  • ' + f.title);
  for (const l of f.detail.split('\n')) console.error('      ' + l);
  console.error('');
}
console.error('These protect the checkout BAC water estimator, which has silently');
console.error('regressed three times. Fix the code -- do not weaken the guard.\n');
process.exit(1);
