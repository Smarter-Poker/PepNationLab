import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/admin-audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// On-demand reveal of a single stored provisioned password. Plaintext passwords
// are NO LONGER shipped in the admin list payloads; they are fetched here, one
// at a time, only when an admin explicitly reveals one -- and every reveal is
// written to admin_audit_log.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Invalid User Id.' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, provisioned_password')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
  if (!data || data.provisioned_password == null) {
    return NextResponse.json({ error: 'No Provisioned Password On File.' }, { status: 404 });
  }

  await writeAuditLog(supabase, {
    actorId: gate.userId,
    action: 'admin_reveal_provisioned_password',
    entityType: 'profiles',
    entityId: userId,
    changes: {},
  });

  return NextResponse.json({ password: data.provisioned_password as string });
}
