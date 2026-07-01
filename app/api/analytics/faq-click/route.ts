/**
 * R28 - POST /api/analytics/faq-click
 *
 * Anonymous beacon endpoint called by HelpHint and the help page when a
 * user opens a FAQ answer. Records a row in `public.faq_clicks` via the
 * service-role client so we can build heat-maps of which answers actually
 * get used.
 *
 * Body: { faqId: string; source?: string | null }
 * Auth: not required. User id + role stamped when the caller is signed in.
 * CSRF: skipped - sendBeacon does not carry CSRF tokens. Per-IP rate limit
 *       guards against spam. Allow-list of FAQ ids guards against junk.
 *
 * Failures never bubble back to the client - telemetry is best-effort.
 */
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { FAQ_ITEMS } from '@/lib/help-faq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_IDS = new Set(FAQ_ITEMS.map((it) => it.id));

function dailySalt(): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${process.env.FAQ_CLICK_SALT ?? 'pnl-faq'}-${day}`;
}

function hashIp(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}|${dailySalt()}`)
    .digest('hex')
    .slice(0, 32);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? 'unknown';
  const rl = await rateLimit({
    key: 'faq_click',
    limit: 60,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: { faqId?: unknown; source?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const faqId = typeof body.faqId === 'string' ? body.faqId.trim() : '';
  if (!faqId || !ALLOWED_IDS.has(faqId)) {
    return NextResponse.json({ ok: false, error: 'invalid_faq_id' }, { status: 400 });
  }

  const source =
    typeof body.source === 'string' && body.source.length > 0
      ? body.source.slice(0, 64)
      : null;

  let userId: string | null = null;
  let userRole: string | null = null;
  try {
    const supa = await createClient();
    const { data } = await supa.auth.getUser();
    if (data?.user) {
      userId = data.user.id;
      const { data: prof } = await supa
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
      userRole = (prof?.role as string | undefined) ?? null;
    }
  } catch {
    /* anonymous is fine */
  }

  const ua = req.headers.get('user-agent')?.slice(0, 200) ?? null;
  const ipHash = ip === 'unknown' ? null : hashIp(ip);

  try {
    const svc = await createServiceClient();
    await svc.from('faq_clicks').insert({
      faq_id: faqId,
      source,
      user_role: userRole,
      user_id: userId,
      ip_hash: ipHash,
      user_agent: ua,
    });
  } catch {
    // Best-effort: never fail the beacon.
  }

  return NextResponse.json({ ok: true });
}
