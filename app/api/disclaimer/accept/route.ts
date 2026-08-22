import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * POST /api/disclaimer/accept
 *
 * Records the caller's mandatory Research-Only acknowledgment: flips
 * profiles.disclaimer_v1_accepted -> true (+ disclaimer_accepted_at) and writes
 * the audit row. This is the ONLY place a researcher's acknowledgment is
 * persisted to the profile; the first-login gate in proxy.ts redirects every
 * authenticated request to /accept-disclaimer until this flag is set.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'disclaimer_accept',
    limit: 30,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Wait And Try Again.' },
      { status: 429 },
    );
  }

  try {
    // User is resolved from the session cookie only, never the request body.
    const supabase = await createClient();
    const { data: { user } } = await getEffectiveUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Authentication Required.' }, { status: 401 });
    }

    const nowIso = new Date().toISOString();
    const svc = await createServiceClient();

    const { error: updErr } = await svc
      .from('profiles')
      .update({ disclaimer_v1_accepted: true, disclaimer_accepted_at: nowIso })
      .eq('id', user.id);
    if (updErr) {
      console.error('[disclaimer/accept] profile update failed:', updErr);
      return NextResponse.json({ error: 'Failed To Record Acknowledgment.' }, { status: 500 });
    }

    // Immutable audit trail (best-effort; the profile flag above is the gate of
    // record). Mirrors the columns written by /api/disclaimer-log.
    const disclaimerVersion = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';
    const userAgent = req.headers.get('user-agent') || null;
    const { error: auditErr } = await svc.from('disclaimer_acceptances').insert({
      user_id: user.id,
      session_id: null,
      disclaimer_version: disclaimerVersion,
      layer: 'site_entry',
      ip_address: ip,
      user_agent: userAgent,
      age_verified: true,
      verified_age: null,
    });
    if (auditErr) console.error('[disclaimer/accept] audit insert failed:', auditErr);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[disclaimer/accept] POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
