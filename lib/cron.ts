import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * Constant-time comparison between the configured CRON_SECRET and the
 * Bearer token from the request. Returns a 401 Response when the secret
 * is missing, mis-shaped, or wrong; returns null when the request is
 * authorized. Use:
 *
 *   const unauth = assertCronAuth(req); if (unauth) return unauth;
 */
export function assertCronAuth(req: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  const got = header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : header;

  // Guard: if either side is missing, reject immediately.
  // We still proceed to the hash comparison below (constant-time path).
  if (!expected || !got) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Hash both sides to fixed-length SHA-256 digests before comparing.
    // This prevents length-based timing attacks - the comparison always
    // runs in O(32) regardless of how long the secret or token is.
    const expectedBuf = crypto.createHash('sha256').update(expected).digest();
    const gotBuf = crypto.createHash('sha256').update(got).digest();
    if (!crypto.timingSafeEqual(expectedBuf, gotBuf)) {
      return new Response('Unauthorized', { status: 401 });
    }
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  return null;
}

/**
 * Attempt to claim a unique cron run for the given job + partition key.
 * Returns { id } on a successful claim, or null if a run already exists
 * for that (job_name, partition_key) tuple (i.e. another invocation
 * already ran or is running this slice of work).
 *
 * Relies on the UNIQUE (job_name, partition_key) constraint on the
 * cron_runs table to make claims race-safe.
 */
export async function claimCronRun(
  jobName: string,
  partitionKey: string
): Promise<{ id: string } | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('cron_runs')
    .insert({
      job_name: jobName,
      partition_key: partitionKey,
      status: 'running',
    })
    .select('id')
    .maybeSingle();

  if (error || !data) {
    // Unique-violation (already ran) or transient - treat as not-claimed.
    return null;
  }

  return { id: data.id as string };
}

/**
 * Mark a previously claimed cron run as succeeded or failed.
 * Best-effort: any error is swallowed so cron handlers stay resilient.
 */
export async function finishCronRun(
  id: string,
  status: 'succeeded' | 'failed' | 'partial_failure',
  notes?: string
): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase
      .from('cron_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        notes: notes ?? null,
      })
      .eq('id', id);
  } catch {
    // Intentionally swallow; cron run bookkeeping must not break the job.
  }
}
