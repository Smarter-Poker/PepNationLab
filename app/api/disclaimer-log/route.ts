import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';

const VALID_LAYERS = ['site_entry', 'registration', 'add_to_cart', 'checkout'] as const;
type DisclaimerLayer = (typeof VALID_LAYERS)[number];

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const callerIp = getClientIp(req);
  const limited = await rateLimit({
    key: 'disclaimer_log',
    limit: 60,
    windowSeconds: 60,
    identifier: callerIp,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Wait And Try Again.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const rawLayer = String((body as { layer?: unknown }).layer ?? 'site_entry');

  // P1: Validate layer is one of the known enum values.
  if (!VALID_LAYERS.includes(rawLayer as DisclaimerLayer)) {
    return NextResponse.json({ error: 'Invalid Disclaimer Layer.' }, { status: 400 });
  }
  const layer = rawLayer as DisclaimerLayer;

  // Optional age-gate fields. Only meaningful on site_entry, but we accept them
  // on any layer in case future flows want to record a re-verification.
  const rawAgeVerified = (body as { age_verified?: unknown }).age_verified;
  const ageVerified = rawAgeVerified === true || rawAgeVerified === 'true';
  const rawVerifiedAge = (body as { verified_age?: unknown }).verified_age;
  let verifiedAge: number | null = null;
  if (rawVerifiedAge !== undefined && rawVerifiedAge !== null && rawVerifiedAge !== '') {
    const n = Number(rawVerifiedAge);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 150) {
      return NextResponse.json({ error: 'Invalid Age Value.' }, { status: 400 });
    }
    verifiedAge = n;
  }

  // P0: Resolve the user from the session cookie -- never from the request body.
  // user_id is always set from the authenticated session so a caller cannot
  // forge attribution to another user. The DB WITH CHECK policy is a backstop,
  // but we enforce it here as well.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && layer !== 'site_entry') {
    return NextResponse.json({ error: 'Authentication Required.' }, { status: 401 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null;

  const userAgent = req.headers.get('user-agent') || null;

  // Never trust a client-supplied disclaimer version. Use the server env value.
  const disclaimerVersion = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';

  // Use the service-role client only for the insert. site_entry rows are
  // anonymous (user_id is null) so they cannot pass the RLS check the anon
  // role would enforce. user_id is sourced exclusively from the session above,
  // never from the request body.
  const serviceSupabase = await createServiceClient();
  const { error } = await serviceSupabase.from('disclaimer_acceptances').insert({
    user_id: user?.id ?? null,
    disclaimer_version: disclaimerVersion,
    layer,
    ip_address: ip,
    user_agent: userAgent,
    age_verified: ageVerified,
    verified_age: verifiedAge,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed To Log Disclaimer Acceptance.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
