/**
 * GET /api/cron/label-jobs - DISABLED
 *
 * Shipping labels are now created MANUALLY (on-demand) only: an admin or agent
 * purchases each label explicitly via the synchronous Shippo flow
 * (single-order "Purchase Label", or the admin Orders bulk "Generate Labels"
 * action). There is no background label generation, so this cron no longer
 * runs - it was removed from vercel.json and this handler is a disabled stub.
 *
 * Kept as a stub (rather than deleted) so any stray scheduled invocation or
 * external hit returns a clear 410 instead of 404, and never drains the queue.
 */

import type { NextRequest } from 'next/server';
import { assertCronAuth } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  return Response.json(
    {
      ok: false,
      disabled: true,
      reason: 'Label generation is manual/synchronous only; this cron is retired.',
    },
    { status: 410 },
  );
}
