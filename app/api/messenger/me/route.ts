import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * round-22c: tiny endpoint returning the calling user's id + role +
 * super/sub flags. MessengerShell needs the caller role so it can
 * skip the realtime allow-list for admins (otherwise admins miss
 * notifications from non-downline DMs once the sidebar filter from
 * round-22 is applied). The pre-existing /api/auth/resolve does NOT
 * return role - it's a username→email lookup - so calling it from
 * the messenger shell was a no-op.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const svc = await createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, is_admin_account')
    .eq('id', user.id)
    .maybeSingle();

  // Admin accounts (is_admin_account=true, e.g. Savage Brands) are brand-level
  // admins, NOT the platform superadmin. Return their role as 'agent' so
  // MessengerShell gives them the flat, agent-level messenger experience
  // (proper realtime allow-list, no platform-wide hierarchy).
  const isAdminAccount = (data as { is_admin_account?: boolean } | null)?.is_admin_account === true;
  const effectiveRole = isAdminAccount && data?.role === 'admin' ? 'agent' : (data?.role ?? null);

  const res = NextResponse.json({
    id: user.id,
    role: effectiveRole as string | null,
    is_super_agent: (data as { is_super_agent?: boolean } | null)?.is_super_agent === true,
    is_sub_agent: (data as { is_sub_agent?: boolean } | null)?.is_sub_agent === true,
  });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}
