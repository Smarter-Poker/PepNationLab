/**
 * GET /api/admin/shippo/webhook-events
 *
 * Admin observability for inbound Shippo webhook deliveries. Returns rolling
 * counts plus the most recent events so the Shipping Settings page can show
 * whether webhooks are arriving and flag any that failed processing or were
 * rejected for a bad signature.
 *
 * Response:
 *   {
 *     counts: { total_7d, processed_7d, failed_open, rejected_7d, last_received_at },
 *     recent: Array<{ event_type, processing_error, processed_at, received_at, rejected }>
 *   }
 *
 * Guards: admin role only (read).
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Recent events (small projection - never return the full payload here).
  const { data: recentRows } = await supabase
    .from('shippo_webhook_events')
    .select('event_id, event_type, processing_error, processed_at, received_at')
    .order('received_at', { ascending: false })
    .limit(25);

  const recent = (recentRows ?? []).map((r) => {
    const key = String(r.event_id ?? '');
    const rejected = key.startsWith('rejected:') || r.processing_error === 'signature_invalid';
    return {
      event_type: r.event_type as string,
      processing_error: (r.processing_error as string | null) ?? null,
      processed_at: (r.processed_at as string | null) ?? null,
      received_at: r.received_at as string,
      rejected,
    };
  });

  // Rolling counts over the trailing 7 days (each an independent head+count query).
  const totalQ = await supabase
    .from('shippo_webhook_events')
    .select('id', { count: 'exact', head: true })
    .gte('received_at', windowStart);

  const processedQ = await supabase
    .from('shippo_webhook_events')
    .select('id', { count: 'exact', head: true })
    .gte('received_at', windowStart)
    .not('processed_at', 'is', null);

  const failedOpenQ = await supabase
    .from('shippo_webhook_events')
    .select('id', { count: 'exact', head: true })
    .gte('received_at', windowStart)
    .not('processing_error', 'is', null)
    .neq('processing_error', 'signature_invalid')
    .not('event_id', 'like', 'rejected:%');

  const rejectedQ = await supabase
    .from('shippo_webhook_events')
    .select('id', { count: 'exact', head: true })
    .gte('received_at', windowStart)
    .like('event_id', 'rejected:%');

  return NextResponse.json({
    counts: {
      total_7d: totalQ.count ?? 0,
      processed_7d: processedQ.count ?? 0,
      failed_open: failedOpenQ.count ?? 0,
      rejected_7d: rejectedQ.count ?? 0,
      last_received_at: recent.length > 0 ? recent[0].received_at : null,
    },
    recent,
  });
}
