import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

/**
 * /api/account/addresses  (Round 25)
 * ----------------------------------
 * GET   list addresses for the calling user (both ship-to AND ship-from)
 * POST  create a new address, optionally as ship-to, ship-from, or both
 *
 * Schema flags on saved_addresses (all BOOLEAN):
 *   is_ship_to        eligible for ship-to selection
 *   is_ship_from      eligible for ship-from selection
 *   is_default        default ship-to
 *   is_default_from   default ship-from
 */

const AddressSchema = z
  .object({
    label: z.string().max(80).nullable().optional(),
    full_name: z.string().min(1).max(120),
    street1: z.string().min(1).max(200),
    street2: z.string().max(200).nullable().optional(),
    city: z.string().min(1).max(120),
    state: z.string().min(1).max(60),
    zip: z.string().min(1).max(20),
    country: z.string().min(2).max(60).default('US'),
    is_ship_to: z.boolean().optional().default(true),
    is_ship_from: z.boolean().optional().default(false),
  })
  .refine((v) => v.is_ship_to || v.is_ship_from, {
    message: 'must_be_at_least_one_kind',
    path: ['is_ship_to'],
  });

const FIELDS =
  'id, label, full_name, street1, street2, city, state, zip, country, is_default, is_default_from, is_ship_to, is_ship_from, created_at, updated_at';

// Authed PII route: saved addresses must never be cached by the browser,
// CDN, or any shared proxy - on success or error alike.
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

  const { data, error } = await supabase
    .from('saved_addresses')
    .select(FIELDS)
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ data }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

  const body = await req.json().catch(() => null);
  const parsed = AddressSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400, headers: NO_STORE });

  // First address of each kind becomes its kind's default automatically.
  const { data: existing } = await supabase
    .from('saved_addresses')
    .select('id, is_ship_to, is_ship_from')
    .eq('user_id', user.id);

  const hasAnyShipTo = (existing ?? []).some((a) => a.is_ship_to);
  const hasAnyShipFrom = (existing ?? []).some((a) => a.is_ship_from);

  const { data, error } = await supabase
    .from('saved_addresses')
    .insert({
      user_id: user.id,
      label: parsed.data.label ?? null,
      full_name: parsed.data.full_name,
      street1: parsed.data.street1,
      street2: parsed.data.street2 ?? null,
      city: parsed.data.city,
      state: parsed.data.state,
      zip: parsed.data.zip,
      country: parsed.data.country,
      is_ship_to: parsed.data.is_ship_to,
      is_ship_from: parsed.data.is_ship_from,
      is_default: parsed.data.is_ship_to && !hasAnyShipTo,
      is_default_from: parsed.data.is_ship_from && !hasAnyShipFrom,
    })
    .select(FIELDS)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ data }, { headers: NO_STORE });
}
