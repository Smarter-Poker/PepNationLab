import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * fix-56 #6: Find-or-create the user's support conversation with admin.
 * Backed by fn_messenger_support_open RPC so the lookup is atomic.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'messenger_support_open',
    limit: 20,
    windowSeconds: 60,
    identifier: user.id || ip,
  });
  if (!limited.allowed) return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('fn_messenger_support_open', { p_user_id: user.id });
  if (error || !data) {
    return NextResponse.json({ error: 'Failed To Open Support' }, { status: 500 });
  }

  return NextResponse.json({ conversationId: data });
}
