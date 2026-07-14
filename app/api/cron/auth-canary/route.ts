export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { runAuthFlowCanary } from '@/lib/auth-canary';

/**
 * GET /api/cron/auth-canary  (Daily, CRON_SECRET)
 *
 * Runs The Shared Auth Flow Canary (lib/auth-canary.ts) Every Day So Any
 * Regression In Signup, Google OAuth Profile Capture, Username Resolve, Or
 * Password Login Is Detected Automatically. Results Are Recorded In
 * cron_runs (job_name = auth_canary); A Failed Run Stores The Failing Step
 * List In The Notes Column And Returns 500 So It Also Surfaces In Vercel's
 * Cron Monitoring.
 */
export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const day = new Date().toISOString().slice(0, 10);
  const claim = await claimCronRun('auth_canary', day);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already ran today' });
  }

  // Vercel invokes crons on the DEPLOYMENT URL, where a self-fetch of
  // /api/auth/resolve hits Vercel deployment protection (401 HTML) and made
  // every scheduled run fail at resolve_username. Probe the canonical site
  // origin instead (same pattern as lib/email.ts).
  const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com').replace(/\/$/, '');
  const result = await runAuthFlowCanary(origin);

  const failing = result.steps.filter((s) => !s.ok).map((s) => `${s.name}${s.detail ? `: ${s.detail}` : ''}`);
  await finishCronRun(
    claim.id,
    result.ok ? 'succeeded' : 'failed',
    result.ok
      ? `all ${result.steps.length} steps passed in ${result.duration_ms}ms`
      : `error=${result.error ?? 'unknown'}; failing=${failing.join(' | ').slice(0, 900)}`,
  );

  if (!result.ok) {
    console.error('[auth-canary] FAILED:', result.error, JSON.stringify(result.steps));
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
