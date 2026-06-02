import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

/**
 * /api/account/payment-method  (Round 25)
 * ---------------------------------------
 * GET   returns { default_payment_method, payment_handles }
 * PUT   accepts a partial — { default_payment_method? , payment_handles? }
 *        - default_payment_method: one of the 9 enum slugs, or null
 *        - payment_handles: object keyed by method slug -> string handle
 *
 * Storage:
 *   profiles.default_payment_method TEXT  (CHECK constraint enforces enum)
 *   profiles.payment_handles        JSONB DEFAULT '{}'
 *
 * Both columns already exist in the live schema; no migration needed.
 */

const PAYMENT_METHOD_ENUM = [
  'zelle',
  'venmo',
  'cashapp',
  'apple_pay',
  'apple_cash',
  'paypal',
  'google_wallet',
  'wise',
  'chime',
] as const;

// Up to 9 handle keys, each value capped so users cannot stuff the JSONB column.
const HandlesSchema = z
  .record(
    z.enum(PAYMENT_METHOD_ENUM),
    z.string().min(1).max(200),
  )
  .refine((h) => Object.keys(h).length <= PAYMENT_METHOD_ENUM.length, {
    message: 'too_many_handles',
  });

const PutSchema = z
  .object({
    default_payment_method: z.enum(PAYMENT_METHOD_ENUM).nullable().optional(),
    payment_handles: HandlesSchema.optional(),
  })
  .refine(
    (v) => v.default_payment_method !== undefined || v.payment_handles !== undefined,
    { message: 'empty_body' },
  );

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('profiles')
    .select('default_payment_method, payment_handles')
    .eq('id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({
    data: {
      default_payment_method: data?.default_payment_method ?? null,
      payment_handles: (data?.payment_handles as Record<string, string> | null) ?? {},
    },
  });
}

export async function PUT(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.default_payment_method !== undefined) {
    update.default_payment_method = parsed.data.default_payment_method;
  }
  if (parsed.data.payment_handles !== undefined) {
    // Trim values defensively even though Zod already validated length.
    const trimmed: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.data.payment_handles)) {
      const s = (v as string).trim();
      if (s.length > 0) trimmed[k] = s;
    }
    update.payment_handles = trimmed;
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
