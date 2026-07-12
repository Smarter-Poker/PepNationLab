import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * First-party acquisition attribution capture.
 *
 * Records one row per anonymous visitor_id (first-touch immutable,
 * last-touch refreshed) via the record_attribution RPC. If the request
 * carries an authenticated session, the visitor's user_id is stamped so the
 * row can later be linked to an order by the stamp_attribution_on_order
 * trigger.
 *
 * No ad-platform pixels, no third-party beacons: attribution is first-party
 * only, which on a research-peptide storefront is a compliance feature.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const visitorId =
    typeof body?.visitor_id === 'string' ? body.visitor_id.trim().slice(0, 100) : '';
  if (!visitorId || !UUID_RE.test(visitorId)) {
    return NextResponse.json({ error: 'Invalid visitor_id' }, { status: 400 });
  }

  // Two-key rate limit. Per-visitor alone was floodable: a bot rotating a
  // random visitor_id per request never fills any bucket while record_attribution
  // upserts one row per id -- unbounded table growth. The IP bucket closes that.
  const ipLimited = await rateLimit({
    key: 'attribution_ip',
    limit: 30,
    windowSeconds: 60,
    identifier: getClientIp(req),
  });
  if (!ipLimited.allowed) {
    return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });
  }
  const limited = await rateLimit({
    key: 'attribution_record',
    limit: 20,
    windowSeconds: 60,
    identifier: visitorId,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });
  }

  const str = (v: unknown, max = 200): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
  };

  // Optional auth: an identified session upgrades the anon row to a known user.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc('record_attribution', {
      p_visitor_id: visitorId,
      p_user_id: userId, // @ts-ignore
      p_utm_source: str(body?.utm_source), // @ts-ignore
      p_utm_medium: str(body?.utm_medium), // @ts-ignore
      p_utm_campaign: str(body?.utm_campaign), // @ts-ignore
      p_utm_content: str(body?.utm_content), // @ts-ignore
      p_utm_term: str(body?.utm_term), // @ts-ignore
      p_referrer: str(body?.referrer, 300), // @ts-ignore
      p_landing_path: str(body?.landing_path, 300), // @ts-ignore
    });
    if (error) {
      console.error('Attribution record error:', error);
      return NextResponse.json({ error: 'Failed to record' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
