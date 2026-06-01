import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/coupons/bulk
 *
 * Bulk-generates N unique coupon codes sharing the same discount terms.
 * Useful for influencer campaigns where each link needs a distinct code.
 *
 * Body:
 *   {
 *     prefix: "WELCOME",          // 2-12 chars from [A-Z0-9-]; final = prefix-NNN
 *     count:  50,                 // 1-500 codes per request
 *     discount_type: "percent",
 *     discount_value: 10,
 *     min_order_amount?: number,
 *     max_uses_per_user?: number, // applies to every generated code
 *     expires_at?: string,
 *     starts_at?: string,
 *     new_customers_only?: boolean,
 *     single_use?: boolean        // when true, each code becomes max_uses=1
 *   }
 *
 * Caps:
 *   - Max 500 codes per request.
 *   - 1 bulk request per agent per 5 minutes (rate-limit).
 *   - Code collision retries up to 5x per slot.
 */

const PREFIX_REGEX = /^[A-Z0-9-]{2,12}$/;
const RANDOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // dropped O/0, I/1 to avoid confusion

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function randomSuffix(len = 4): string {
  let s = '';
  const a = RANDOM_ALPHABET;
  for (let i = 0; i < len; i++) {
    s += a[Math.floor(Math.random() * a.length)];
  }
  return s;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const limited = await rateLimit({
    key: 'coupons_bulk',
    limit: 1,
    windowSeconds: 300,
    identifier: gate.user.id,
  });
  if (!limited.allowed) {
    return bad('Bulk Generation Is Rate-Limited. Please Wait A Few Minutes Before The Next Batch.', 429);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad('Invalid Request Body.'); }

  const prefix = typeof body.prefix === 'string' ? body.prefix.trim().toUpperCase() : '';
  if (!PREFIX_REGEX.test(prefix)) {
    return bad('Prefix Must Be 2 To 12 Characters: Letters, Numbers, Hyphens Only.');
  }

  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return bad('Count Must Be A Whole Number Between 1 And 500.');
  }

  const discountType = body.discount_type === 'fixed' ? 'fixed' : body.discount_type === 'percent' ? 'percent' : null;
  if (!discountType) return bad('Discount Type Must Be Percent Or Fixed.');

  const discountValueRaw = Number(body.discount_value);
  if (!Number.isFinite(discountValueRaw) || discountValueRaw <= 0) {
    return bad('Discount Value Must Be Greater Than Zero.');
  }
  if (discountType === 'percent' && (discountValueRaw < 1 || discountValueRaw > 90)) {
    return bad('Percent Discount Must Be Between 1% And 90%.');
  }
  if (discountType === 'fixed' && (discountValueRaw < 1 || discountValueRaw > 500)) {
    return bad('Fixed Discount Must Be Between $1 And $500.');
  }
  const discountValue = Math.round(discountValueRaw * 100) / 100;

  let minOrder: number | null = null;
  if (body.min_order_amount !== undefined && body.min_order_amount !== null && body.min_order_amount !== '') {
    const n = Number(body.min_order_amount);
    if (!Number.isFinite(n) || n < 0) return bad('Minimum Order Must Be Zero Or Greater.');
    minOrder = Math.round(n * 100) / 100;
  }
  if (discountType === 'fixed') {
    if (minOrder == null) return bad('A Fixed-Amount Coupon Requires A Minimum Order.');
    if (discountValue > minOrder) return bad('Fixed Discount Cannot Be Greater Than Minimum Order.');
  }

  let maxPerUser: number | null = null;
  if (body.max_uses_per_user !== undefined && body.max_uses_per_user !== null && body.max_uses_per_user !== '') {
    const n = Number(body.max_uses_per_user);
    if (!Number.isInteger(n) || n < 1) return bad('Max Uses Per User Must Be A Whole Number Of One Or More.');
    maxPerUser = n;
  }

  const singleUse = body.single_use === true;
  const newCustomersOnly = body.new_customers_only === true;

  function parseTs(input: unknown, allowPast = false): string | null | undefined {
    if (input === undefined) return undefined;
    if (input === null || input === '') return null;
    const s = String(input);
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T23:59:59Z` : s;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return undefined;
    if (!allowPast && t <= Date.now()) return undefined;
    return new Date(t).toISOString();
  }
  const startsAt = parseTs(body.starts_at, true);
  if (startsAt === undefined) return bad('Start Date Is Invalid.');
  const expiresAt = parseTs(body.expires_at, false);
  if (expiresAt === undefined) return bad('Expiration Date Must Be A Valid Future Date.');
  if (startsAt && expiresAt && Date.parse(startsAt) >= Date.parse(expiresAt)) {
    return bad('Expiration Must Be After The Start Date.');
  }

  const svc = await createServiceClient();

  const existingCodes = new Set<string>();
  const { data: agentCoupons } = await svc
    .from('coupons')
    .select('code')
    .eq('agent_id', gate.user.id);
  agentCoupons?.forEach((c: { code: string }) => existingCodes.add(c.code));

  const rows: Array<{ code: string; agent_id: string }> = [];
  const codesGenerated = new Set<string>();
  let attempts = 0;
  while (rows.length < count && attempts < count * 6) {
    attempts += 1;
    const sfx = randomSuffix(4 + (count > 200 ? 1 : 0)); // bump entropy when batch is huge
    const candidate = `${prefix}-${sfx}`.slice(0, 24);
    if (!/^[A-Z0-9-]{3,24}$/.test(candidate)) continue;
    if (existingCodes.has(candidate) || codesGenerated.has(candidate)) continue;
    codesGenerated.add(candidate);
    rows.push({ code: candidate, agent_id: gate.user.id });
  }

  if (rows.length < count) {
    return bad('Could Not Generate Enough Unique Codes. Try A Different Prefix Or A Smaller Count.', 422);
  }

  const insertPayload = rows.map((r) => ({
    agent_id: r.agent_id,
    code: r.code,
    discount_type: discountType,
    discount_value: discountValue,
    min_order_amount: minOrder,
    max_uses: singleUse ? 1 : null,
    max_uses_per_user: singleUse ? 1 : maxPerUser,
    starts_at: startsAt ?? null,
    expires_at: expiresAt ?? null,
    new_customers_only: newCustomersOnly,
    is_active: true,
  }));

  const { data: inserted, error: insertErr } = await svc
    .from('coupons')
    .insert(insertPayload)
    .select('id, code');

  if (insertErr) {
    console.error('[coupons/bulk] insert error:', insertErr);
    return bad('Failed To Create Bulk Coupons.', 500);
  }

  return NextResponse.json({
    success: true,
    count: inserted?.length ?? 0,
    coupons: inserted ?? [],
  });
}
