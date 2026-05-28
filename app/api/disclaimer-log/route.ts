import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const VALID_LAYERS = ['site_entry', 'registration', 'add_to_cart', 'checkout'] as const;
type DisclaimerLayer = (typeof VALID_LAYERS)[number];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const rawLayer = String((body as { layer?: unknown }).layer ?? 'site_entry');

  if (!VALID_LAYERS.includes(rawLayer as DisclaimerLayer)) {
    return NextResponse.json({ error: 'Invalid Disclaimer Layer' }, { status: 400 });
  }
  const layer = rawLayer as DisclaimerLayer;

  // Resolve the user from the session cookie. RLS on disclaimer_acceptances
  // requires user_id = auth.uid() for any layer other than site_entry, so we
  // authenticate first and gate accordingly.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && layer !== 'site_entry') {
    return NextResponse.json({ error: 'Authentication Required' }, { status: 401 });
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
  // role would enforce.
  const serviceSupabase = await createServiceClient();
  const { error } = await serviceSupabase.from('disclaimer_acceptances').insert({
    user_id: user?.id ?? null,
    disclaimer_version: disclaimerVersion,
    layer,
    ip_address: ip,
    user_agent: userAgent,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed To Log Disclaimer Acceptance' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
