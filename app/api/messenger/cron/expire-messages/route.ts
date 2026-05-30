import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCronAuth } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = getCronAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const svc = await createServiceClient();
  const nowIso = new Date().toISOString();

  // Audit9: drain oldest first so backlogged rows are guaranteed to clear.
  const { data: due, error: qErr } = await svc
    .from('messenger_messages')
    .select('id')
    .lte('expires_at', nowIso)
    .eq('is_deleted', false)
    .order('expires_at', { ascending: true })
    .limit(200);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const ids = (due ?? []).map((r) => r.id as string);
  if (ids.length === 0) return NextResponse.json({ expired: 0, scanned: 0 });

  const { data: expired, error: upErr } = await svc
    .from('messenger_messages')
    .update({
      is_deleted: true,
      delete_scope: 'for_everyone',
      text: null,
      media_url: null,
      media_metadata: {},
      updated_at: nowIso,
    })
    .in('id', ids)
    .eq('is_deleted', false)
    .select('id');
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ expired: (expired ?? []).length, scanned: ids.length });
}
