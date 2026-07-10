import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Certificate Of Analysis results, verification, and retraction.
 *
 * Every value written here comes from a signed certificate supplied by a
 * testing lab. Nothing on this route derives, estimates, defaults, or generates
 * an analytical result. A field the lab did not report stays NULL and renders as
 * "Not Reported" -- the absence of a measurement is itself information a
 * researcher is entitled to.
 *
 *   PATCH                  Enter or correct results on an UNVERIFIED lot.
 *   POST ?action=verify    Admin attests the entered values match the signed PDF.
 *                          Freezes the results permanently.
 *   POST ?action=retract   Withdraw a published certificate. One-way. Requires a
 *                          reason. Does not delete the record.
 */

interface Params {
  params: Promise<{ id: string; lotId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

function toDateOrUndefined(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return s;
}

/**
 * Parses a reported numeric result. Returns `undefined` for "field absent"
 * (leave untouched) and `null` for "explicitly not reported". An unparseable or
 * out-of-range value is rejected rather than coerced, because a coerced purity
 * figure is a fabricated purity figure.
 */
function toNumberInRange(
  v: unknown,
  min: number,
  max: number,
): number | null | undefined | 'invalid' {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return 'invalid';
  if (n < min || n > max) return 'invalid';
  return n;
}

function toIntInRange(
  v: unknown,
  min: number,
  max: number,
): number | null | undefined | 'invalid' {
  const n = toNumberInRange(v, min, max);
  if (n === undefined || n === null || n === 'invalid') return n;
  if (!Number.isInteger(n)) return 'invalid';
  return n;
}

function toTextOrNull(v: unknown, max: number): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v).trim().slice(0, max);
}

const TEXT_FIELDS: Array<[string, number]> = [
  ['purity_method', 120],
  ['hplc_column', 200],
  ['ms_method', 120],
  ['appearance', 200],
  ['testing_lab', 200],
  ['lab_report_number', 120],
  ['lab_accreditation', 120],
];

const NUMERIC_FIELDS: Array<[string, number, number]> = [
  ['purity_pct', 0.01, 100],
  ['water_content_pct', 0, 100],
  ['net_peptide_content_pct', 0.01, 100],
  ['ms_observed_mass_da', 0.0001, 1_000_000],
  ['ms_theoretical_mass_da', 0.0001, 1_000_000],
];

export async function PATCH(req: NextRequest, { params }: Params) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id, lotId } = await params;
  if (!isUuid(id) || !isUuid(lotId)) {
    return NextResponse.json({ error: 'Invalid Id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  for (const [field, max] of TEXT_FIELDS) {
    if (field in body) patch[field] = toTextOrNull(body[field], max);
  }

  for (const [field, min, max] of NUMERIC_FIELDS) {
    if (!(field in body)) continue;
    const parsed = toNumberInRange(body[field], min, max);
    if (parsed === 'invalid') {
      return NextResponse.json(
        { error: `Reported Value For ${field} Is Outside The Accepted Range.` },
        { status: 400 },
      );
    }
    patch[field] = parsed;
  }

  if ('hplc_wavelength_nm' in body) {
    const parsed = toIntInRange(body.hplc_wavelength_nm, 180, 800);
    if (parsed === 'invalid') {
      return NextResponse.json(
        { error: 'Detection Wavelength Must Be A Whole Number Between 180 And 800 Nanometres.' },
        { status: 400 },
      );
    }
    patch.hplc_wavelength_nm = parsed;
  }

  if ('lab_is_third_party' in body) {
    patch.lab_is_third_party =
      body.lab_is_third_party === null ? null : Boolean(body.lab_is_third_party);
  }

  const testDate = toDateOrUndefined(body?.test_date);
  if (testDate !== undefined) {
    if (testDate !== null && testDate > new Date().toISOString().slice(0, 10)) {
      return NextResponse.json(
        { error: 'A Test Date Cannot Be In The Future.' },
        { status: 400 },
      );
    }
    patch.test_date = testDate;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No Result Fields Supplied.' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from('product_lots')
    .select('id, coa_verified_at')
    .eq('id', lotId)
    .eq('product_id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Lot Not Found.' }, { status: 404 });
  }

  // The database enforces this too. Checking here produces a usable message
  // rather than a raw trigger exception.
  if (existing.coa_verified_at) {
    return NextResponse.json(
      {
        error:
          'This Certificate Is Verified And Its Results Are Frozen. Retract It, Or Supersede The Lot With A New Record.',
      },
      { status: 409 },
    );
  }

  const { data: lot, error } = await supabase
    .from('product_lots')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', lotId)
    .eq('product_id', id)
    .select('*')
    .maybeSingle();

  if (error || !lot) {
    return NextResponse.json({ error: 'Failed To Save Certificate Results.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'coa_results_update',
    entity_type: 'product_lots',
    entity_id: lot.id,
    changes: { product_id: id, fields: Object.keys(patch) },
  });

  return NextResponse.json({ lot });
}

export async function POST(req: NextRequest, { params }: Params) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id, lotId } = await params;
  if (!isUuid(id) || !isUuid(lotId)) {
    return NextResponse.json({ error: 'Invalid Id.' }, { status: 400 });
  }

  const action = new URL(req.url).searchParams.get('action');
  if (action !== 'verify' && action !== 'retract') {
    return NextResponse.json(
      { error: 'Action Must Be Verify Or Retract.' },
      { status: 400 },
    );
  }

  const supabase = await createServiceClient();

  const { data: lot } = await supabase
    .from('product_lots')
    .select('id, lot_number, coa_verified_at, coa_retracted_at, coa_storage_key, testing_lab, test_date, purity_pct')
    .eq('id', lotId)
    .eq('product_id', id)
    .maybeSingle();

  if (!lot) {
    return NextResponse.json({ error: 'Lot Not Found.' }, { status: 404 });
  }

  if (action === 'verify') {
    if (lot.coa_verified_at) {
      return NextResponse.json(
        { error: 'This Certificate Is Already Verified.' },
        { status: 409 },
      );
    }

    // A certificate is only verifiable if the things that make it verifiable are
    // present. The database enforces the same rule; this yields a clear message.
    const missing: string[] = [];
    if (!lot.coa_storage_key) missing.push('The Signed Certificate File');
    if (!lot.testing_lab) missing.push('The Testing Laboratory');
    if (!lot.test_date) missing.push('The Test Date');
    if (lot.purity_pct === null || lot.purity_pct === undefined) missing.push('The Reported Purity');

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot Verify Without: ${missing.join(', ')}.`,
          missing,
        },
        { status: 422 },
      );
    }

    const { data: updated, error } = await supabase
      .from('product_lots')
      .update({
        coa_verified_at: new Date().toISOString(),
        coa_verified_by: gate.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lotId)
      .eq('product_id', id)
      .select('*')
      .maybeSingle();

    if (error || !updated) {
      return NextResponse.json({ error: 'Failed To Verify Certificate.' }, { status: 500 });
    }

    await supabase.from('admin_audit_log').insert({
      actor_id: gate.userId,
      action: 'coa_verify',
      entity_type: 'product_lots',
      entity_id: lotId,
      changes: {
        product_id: id,
        lot_number: updated.lot_number,
        purity_pct: updated.purity_pct,
        testing_lab: updated.testing_lab,
      },
    });

    return NextResponse.json({ lot: updated });
  }

  // action === 'retract'
  if (!lot.coa_verified_at) {
    return NextResponse.json(
      { error: 'Only A Verified Certificate Can Be Retracted.' },
      { status: 409 },
    );
  }
  if (lot.coa_retracted_at) {
    return NextResponse.json(
      { error: 'This Certificate Has Already Been Retracted.' },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const reason = toTextOrNull(body?.reason, 1000);

  if (!reason || reason.length < 10) {
    return NextResponse.json(
      { error: 'A Retraction Requires A Written Reason Of At Least Ten Characters.' },
      { status: 400 },
    );
  }

  const { data: updated, error } = await supabase
    .from('product_lots')
    .update({
      coa_retracted_at: new Date().toISOString(),
      coa_retracted_by: gate.userId,
      coa_retraction_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lotId)
    .eq('product_id', id)
    .select('*')
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed To Retract Certificate.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'coa_retract',
    entity_type: 'product_lots',
    entity_id: lotId,
    changes: { product_id: id, lot_number: updated.lot_number, reason },
  });

  return NextResponse.json({ lot: updated });
}
