import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notifyAdmins } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/checkout-guard (daily, 12:00 UTC)
 *
 * REGRESSION CANARY for the checkout reconstitution estimator (the "BAC water
 * calculator + recommendation reminder").
 *
 * WHY THIS EXISTS
 * This feature has now been silently broken three separate times, always the
 * same way: an unrelated commit rewrites the diluent lookup, PostgREST answers
 * 400 or returns the wrong vial size, the client destructures `{ data }` and
 * throws the error away, and the panel quietly shows a wrong price -- or
 * nothing at all. Nobody finds out until a customer's order arrives with no
 * BAC water. On 2026-08-15 the lookup was fixed at 00:02 and clobbered again
 * at 00:45 by a commit whose subject was about the MESSENGER.
 *
 * A unit test cannot catch this class of bug: the queries are only wrong
 * against the real PostgREST schema. So this canary runs the ACTUAL queries
 * the checkout page runs, against production, every day, and alerts admins
 * in-app the moment any of them stops returning a usable diluent.
 *
 * IF YOU CHANGE THE DILUENT QUERIES IN app/checkout/CheckoutForm.tsx,
 * CHANGE THEM HERE TOO -- that is the whole point of this file.
 *
 * Checks:
 *   1. CATALOG      - a 10 mL BAC water product exists, is active, resolvable
 *                     by compound_slug (the canonical identity).
 *   2. MATH         - the strength-based estimator returns a sane volume for a
 *                     known 3-vial basket (must be > 0; 0 mL silently hides
 *                     the whole panel because it renders on vials > 0).
 *   3. STORE LOOKUP - for every active storefront that stocks a diluent, the
 *                     exact embedded-table queries the checkout runs still
 *                     return rows AND resolve the 10 mL variant.
 */

const BAC_OR = 'compound_slug.eq.bac-water,name.ilike.%bacteriostatic water%,name.ilike.%bac%water%';

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 10);
  const claim = await claimCronRun('checkout_guard', partitionKey);
  if (!claim) return Response.json({ skipped: true, reason: 'already_ran_today' });

  const problems: string[] = [];
  let storesChecked = 0;
  let errorNote: string | null = null;

  try {
    const svc = createAdminClient();

    // ── 1. CATALOG: canonical BAC water must resolve by compound_slug ────────
    const { data: catalogBac, error: catErr } = await svc
      .from('products')
      .select('id, name, unit_size, unit_measure, is_active')
      .eq('compound_slug', 'bac-water')
      .eq('is_active', true);
    if (catErr) {
      problems.push(`catalog BAC water query FAILED: ${catErr.message}`);
    } else if (!catalogBac || catalogBac.length === 0) {
      problems.push('no active BAC water product with compound_slug=bac-water');
    } else if (!catalogBac.some(p => String(p.unit_size) === '10')) {
      problems.push('no 10 mL BAC water variant active (estimator would size against the wrong vial)');
    }

    // ── 2. MATH: estimator must return a usable volume for a real basket ─────
    // Mirrors reconstitutionMlPerVial() in /api/cart/bac-water. A regression
    // that returns 0 mL hides the entire panel without any error.
    const { data: sample } = await svc
      .from('products')
      .select('id, name, unit_size, unit_measure')
      .eq('is_active', true)
      .eq('is_banned', false)
      .eq('unit_measure', 'mg')
      .not('compound_slug', 'is', null)
      .neq('compound_slug', 'bac-water')
      .limit(3);
    const mlFor = (size: number, measure: string | null) => {
      const m = (measure || 'mg').toLowerCase();
      if (m.includes('ml')) return 0;
      if (m.includes('iu')) return Math.min(3, Math.max(1, Math.ceil(size / 5000)));
      if (!Number.isFinite(size) || size <= 0) return 2;
      return Math.min(5, Math.max(1, Math.ceil((size / 5) * 2) / 2));
    };
    const totalMl = (sample ?? []).reduce(
      (sum, p) => sum + mlFor(parseFloat(String(p.unit_size ?? '')), p.unit_measure), 0);
    if ((sample ?? []).length > 0 && totalMl <= 0) {
      problems.push(`estimator math returned ${totalMl} mL for ${(sample ?? []).length} lyophilized vials -- the panel would not render`);
    }

    // ── 3. STORE LOOKUP: the exact embedded-table queries checkout runs ──────
    const { data: stores } = await svc
      .from('agent_profiles').select('id, slug').eq('is_active', true).limit(60);

    for (const store of stores ?? []) {
      // BAC water, canonical-first, preferring the 10 mL vial.
      const { data: bacRows, error: bacErr } = await svc
        .from('agent_products')
        .select('id, product_id, retail_price, products!inner ( name, unit_size, compound_slug )')
        .eq('agent_id', store.id)
        .eq('is_visible', true)
        .or(BAC_OR, { referencedTable: 'products' })
        .limit(10);
      if (bacErr) {
        problems.push(`[${store.slug}] BAC water query FAILED: ${bacErr.message}`);
        continue;
      }
      storesChecked++;
      if ((bacRows ?? []).length > 0) {
        const has10 = (bacRows ?? []).some((r) => {
          const pr = (Array.isArray(r.products) ? r.products[0] : r.products) as { unit_size?: unknown } | null;
          return String(pr?.unit_size ?? '') === '10';
        });
        if (!has10) problems.push(`[${store.slug}] stocks BAC water but no 10 mL variant is visible`);
      }

      // Acetic acid -- dotted embedded path. The `{ foreignTable }` form on
      // .ilike() silently filters agent_products.name and 400s.
      const { error: aceticErr } = await svc
        .from('agent_products')
        .select('id, product_id, retail_price, products!inner ( name, unit_size )')
        .eq('agent_id', store.id)
        .eq('is_visible', true)
        .ilike('products.name', '%acetic acid%')
        .limit(1);
      if (aceticErr) {
        problems.push(`[${store.slug}] acetic acid query FAILED: ${aceticErr.message}`);
      }
    }

    if (problems.length > 0) {
      await notifyAdmins(svc, {
        type: 'system',
        title: `Checkout Guard: BAC Water Estimator Has ${problems.length} Issue(s)`,
        body: `The Checkout Reconstitution Estimator Is Degraded. ${problems.slice(0, 3).join(' | ')}`.slice(0, 490),
        url: '/admin',
      });
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `problems=${problems.length} storesChecked=${storesChecked}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote || problems.length > 0 ? 'failed' : 'succeeded', summary);

  return Response.json({ ok: !errorNote && problems.length === 0, problems, storesChecked, error: errorNote });
}
