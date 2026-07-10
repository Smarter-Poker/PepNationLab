import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Certificate Of Analysis coverage audit.
 *
 * Walks every active product and reports which ones have no verified certificate
 * on file, and which have only a stale one. It writes the result to the admin
 * audit log so the gap is visible and dated.
 *
 * This job REPORTS gaps. It does not fill them. There is no code path here, or
 * anywhere else in this codebase, that creates a certificate or an analytical
 * result: a COA asserts that a specific batch was tested by a named laboratory,
 * and no scheduled task can make that true. Closing a gap means obtaining a real
 * certificate from the manufacturer or an independent lab and uploading it.
 */

const STALE_DAYS = 365;

interface CoverageGap {
  product_id: string;
  product_name: string;
  product_slug: string;
  inventory_count: number | null;
  verified_coa_count: number;
  latest_test_date: string | null;
  gap_reason: string;
}

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron sets this header on scheduled invocations.
  if (req.headers.get('x-vercel-cron')) return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = await createServiceClient();

  const { data, error } = await supabase.rpc('coa_coverage_gaps', { p_stale_days: STALE_DAYS });

  if (error) {
    console.error('[cron/coa-audit] coverage query failed:', error.message);
    return NextResponse.json({ error: 'Coverage Audit Failed.' }, { status: 500 });
  }

  const gaps = (data ?? []) as CoverageGap[];
  const missing = gaps.filter((g) => g.verified_coa_count === 0);
  const stale = gaps.filter((g) => g.verified_coa_count > 0);

  // Products that are missing a certificate AND are currently sellable are the
  // ones that matter most: a researcher can put them in a cart today.
  const inStockWithoutCoa = missing.filter((g) => (g.inventory_count ?? 0) > 0);

  await supabase.from('admin_audit_log').insert({
    actor_id: null,
    action: 'coa_coverage_audit',
    entity_type: 'products',
    entity_id: null,
    changes: {
      audited_at: new Date().toISOString(),
      stale_threshold_days: STALE_DAYS,
      products_without_certificate: missing.length,
      products_with_stale_certificate: stale.length,
      in_stock_without_certificate: inStockWithoutCoa.length,
      in_stock_without_certificate_slugs: inStockWithoutCoa.slice(0, 50).map((g) => g.product_slug),
    },
  });

  return NextResponse.json({
    ok: true,
    audited_at: new Date().toISOString(),
    summary: {
      products_without_certificate: missing.length,
      products_with_stale_certificate: stale.length,
      in_stock_without_certificate: inStockWithoutCoa.length,
    },
    gaps,
  });
}
