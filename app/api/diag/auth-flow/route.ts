export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { runAuthFlowCanary } from '@/lib/auth-canary';

/**
 * POST /api/diag/auth-flow  (Admin Only)
 *
 * On-Demand Run Of The Shared Auth Flow Canary (lib/auth-canary.ts). The Same
 * Probe Runs Automatically Every Day Via GET /api/cron/auth-canary, So This
 * Route Exists For Admins Who Want An Immediate Answer. See lib/auth-canary.ts
 * For The Full List Of Probed Steps.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const userClient = await createClient();
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (caller?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const result = await runAuthFlowCanary(req.nextUrl.origin);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
