import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/receipt — service-worker delivery-receipt beacon.
 *
 * The push pipeline's blind spot (incident 2026-08-04): FCM and Apple answer
 * 2xx for subscriptions whose device is gone — a dead-but-unexpired token is
 * "accepted" and then silently dropped. Server-side send bookkeeping therefore
 * can NEVER distinguish a live device from a zombie. This beacon is the only
 * ground truth: the service worker POSTs here after actually DISPLAYING a
 * push, and /api/cron/push-health alerts on subscriptions that keep getting
 * "accepted" while never confirming display.
 *
 * Deliberately session-less: a push can arrive (and must be confirmed) on a
 * device whose auth cookies have expired. Safety properties that make that
 * acceptable:
 *   - the only effect is bumping last_receipt_at on an EXACT endpoint match;
 *   - endpoints are unguessable high-entropy URLs minted by the push services;
 *   - no data is ever returned, so it cannot be used as an existence oracle
 *     (the response is identical whether or not the endpoint matched);
 *   - rate-limited per IP.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'push_receipt', limit: 60, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  let body: { endpoint?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint || endpoint.length > 1000 || !endpoint.startsWith('https://')) {
    return NextResponse.json({ ok: true });
  }

  try {
    const service = await createServiceClient();
    await service
      .from('push_subscriptions')
      .update({ last_receipt_at: new Date().toISOString() })
      .eq('endpoint', endpoint);
  } catch {
    /* best-effort — the beacon must never error into the service worker */
  }

  return NextResponse.json({ ok: true });
}
