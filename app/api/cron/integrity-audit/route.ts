/**
 * GET /api/cron/integrity-audit
 *
 * Daily money + data integrity surveillance.
 *
 * The pricing engine and the storefront catalog have invariants that, when they
 * silently break, cost real money and are invisible until someone goes looking.
 * This cron looks every day and emails the operator the moment one breaks.
 *
 * What it asserts
 *   1. Pricing invariants, via the SECURITY DEFINER RPC public.fn_validate_pricing():
 *        RETAIL_MISMATCH             retail != base_cost * (1 + markup) * (1 + margin/100)
 *        AT_OR_BELOW_COST            a storefront is selling at or below its own cost
 *        TIER_MARKUP_LOCKSTEP_BROKEN house_tiers.markup != pricing_tiers.multiplier - 1
 *      The RPC evaluates these INSIDE Postgres using the database's own
 *      fn_resolve_house_tier_level(), so it can never drift from production
 *      pricing logic the way a re-implementation would.
 *   2. Active products with a non-positive base_cost (every derived price is wrong).
 *   3. Active agents with no tier assigned (their cost basis falls back to the
 *      most house-protective rate rather than an intentional one).
 *
 * Why this exists: a product's base_cost was once raised without the derived
 * storefront prices being recomputed, and the house storefront's cost basis
 * resolved to a tier markup it should never have had -- a single admin edit away
 * from repricing the entire guest-facing catalog. Both were found by hand. This
 * makes finding them automatic.
 *
 * Read-only: it never writes to pricing or catalog tables. Alerting only.
 *
 * Idempotency: claimCronRun('integrity_audit', YYYY-MM-DD) means a re-trigger
 * inside the same UTC day short-circuits instead of re-alerting.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { emailConfigured, sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';
const ALERT_TO =
  process.env.ALERT_EMAIL || process.env.EMAIL_REPLY_TO || 'support@pepnationlab.com';

/** Rows returned by public.fn_validate_pricing(). */
interface PricingViolation {
  violation: string;
  agent_username: string | null;
  product_name: string | null;
  base_cost: number | null;
  effective_markup: number | null;
  margin_percent: number | null;
  actual_retail: number | null;
  expected_value: number | null;
}

/**
 * Severity matters here. An `error` is money-affecting and must page a human.
 * A `warning` is a config gap that is currently harmless (e.g. an agent with no
 * tier still prices correctly via the most house-protective fallback). Emailing
 * daily about a known-benign warning trains the operator to ignore the mailbox,
 * so warnings are reported in the response but never alert on their own.
 */
type Severity = 'error' | 'warning';

interface Finding {
  kind: string;
  detail: string;
  severity: Severity;
}

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : Number(n).toFixed(2);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const claim = await claimCronRun('integrity_audit', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran', partitionKey });
  }

  const findings: Finding[] = [];

  try {
    const service = createAdminClient();

    // --- 1. Pricing invariants (evaluated in Postgres) --------------------
    const { data: pricingRows, error: pricingErr } = await service.rpc('fn_validate_pricing');
    if (pricingErr) {
      // A missing RPC is itself a finding worth surfacing, not a silent pass.
      findings.push({
        kind: 'PRICING_CHECK_UNAVAILABLE',
        detail: `fn_validate_pricing() could not be executed: ${pricingErr.message}`,
        severity: 'error',
      });
    } else {
      for (const v of (pricingRows ?? []) as PricingViolation[]) {
        if (v.violation === 'TIER_MARKUP_LOCKSTEP_BROKEN') {
          findings.push({
            kind: v.violation,
            detail: `${v.product_name}: multiplier ${money(v.effective_markup)} implies markup ${money(v.expected_value)}, house_tiers has ${money(v.actual_retail)}`,
            severity: 'error',
          });
        } else {
          findings.push({
            kind: v.violation,
            detail: `${v.agent_username}/${v.product_name}: retail ${money(v.actual_retail)} vs expected ${money(v.expected_value)} (base ${money(v.base_cost)}, markup ${money(v.effective_markup)}, margin ${money(v.margin_percent)}%)`,
            severity: 'error',
          });
        }
      }
    }

    // --- 2. Active products with a non-positive base cost -----------------
    const { data: badCost } = await service
      .from('products')
      .select('name, base_cost')
      .eq('is_active', true)
      .or('base_cost.is.null,base_cost.lte.0');
    for (const p of (badCost ?? []) as Array<{ name: string; base_cost: number | null }>) {
      findings.push({
        kind: 'NON_POSITIVE_BASE_COST',
        detail: `${p.name}: base_cost ${p.base_cost ?? 'null'} -- every derived storefront price is wrong`,
        severity: 'error',
      });
    }

    // --- 3. Active agents with no tier assigned ---------------------------
    const { data: tierless } = await service
      .from('profiles')
      .select('username, role')
      .in('role', ['agent', 'super_agent'])
      .eq('is_active', true)
      .is('tier', null);
    for (const a of (tierless ?? []) as Array<{ username: string | null; role: string }>) {
      findings.push({
        kind: 'AGENT_WITHOUT_TIER',
        detail: `${a.username ?? '(no username)'} (${a.role}) has no tier; cost basis falls back to the most house-protective rate`,
        severity: 'warning',
      });
    }

    // --- Alert ------------------------------------------------------------
    // Only money-affecting errors page a human. Warnings are carried in the
    // email when one is already going out, and otherwise stay in the response.
    const errors = findings.filter((f) => f.severity === 'error');
    const warnings = findings.filter((f) => f.severity === 'warning');
    const shouldAlert = errors.length > 0 && emailConfigured();

    if (shouldAlert) {
      const byKind = new Map<string, Finding[]>();
      for (const f of findings) {
        if (!byKind.has(f.kind)) byKind.set(f.kind, []);
        byKind.get(f.kind)!.push(f);
      }

      const sections = Array.from(byKind.entries())
        .map(([kind, rows]) => {
          const items = rows
            .slice(0, 25)
            .map((r) => `<li style="margin:0 0 6px;">${escapeHtml(r.detail)}</li>`)
            .join('');
          const more =
            rows.length > 25
              ? `<li style="margin:0;color:#8b95a3;">and ${rows.length - 25} more</li>`
              : '';
          return `<h2 style="font-size:15px;color:#fff;margin:20px 0 8px;">${escapeHtml(kind)} (${rows.length})</h2><ul style="font-size:13px;line-height:1.6;color:#D0DAE4;padding-left:18px;margin:0;">${items}${more}</ul>`;
        })
        .join('');

      await sendEmail({
        to: ALERT_TO,
        subject: `Pep Nation Lab Integrity Audit: ${errors.length} Money Issue${errors.length === 1 ? '' : 's'} Found`,
        html: `<div style="font-family:Inter,Arial,sans-serif;background:#050A0F;color:#D0DAE4;padding:24px;">
  <h1 style="font-size:19px;color:#00C4BC;margin:0 0 8px;">Integrity Audit</h1>
  <p style="font-size:13px;margin:0 0 4px;">${errors.length} error${errors.length === 1 ? '' : 's'}${warnings.length ? ` and ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''} detected on ${partitionKey}.</p>
  <p style="font-size:12px;color:#8b95a3;margin:0;">Errors affect pricing or catalog correctness. Review before the next order is placed.</p>
  ${sections}
  <p style="font-size:12px;color:#8b95a3;margin:24px 0 0;">Run <code>node scripts/validate-pricing.mjs</code> for the full report. Admin: ${SITE}/admin/pricing</p>
</div>`,
        text:
          `Pep Nation Lab Integrity Audit - ${errors.length} error(s), ${warnings.length} warning(s) on ${partitionKey}\n\n` +
          findings.map((f) => `[${f.severity.toUpperCase()}] [${f.kind}] ${f.detail}`).join('\n'),
      });
    }

    const notes = errors.length || warnings.length
      ? `errors=${errors.length} warnings=${warnings.length}`
      : 'clean';
    await finishCronRun(claim.id, 'succeeded', notes);

    return NextResponse.json({
      success: true,
      partitionKey,
      errors: errors.length,
      warnings: warnings.length,
      alerted: shouldAlert,
      breakdown: findings.reduce<Record<string, number>>((acc, f) => {
        acc[f.kind] = (acc[f.kind] ?? 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
