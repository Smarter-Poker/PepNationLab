import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/** POST: Admin broadcasts a message to multiple recipients */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin Only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { subject, body: msgBody, recipientRole, recipientIds } = body;
  if (!subject || !msgBody) return NextResponse.json({ error: 'Missing subject or body' }, { status: 400 });

  let targetIds: string[] = [];

  if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
    targetIds = recipientIds;
  } else if (recipientRole) {
    const roles = recipientRole === 'all' ? ['agent', 'super_agent', 'researcher'] : [recipientRole];
    const { data: targets } = await service.from('profiles').select('id').in('role', roles);
    targetIds = (targets ?? []).map(t => t.id);
  } else {
    const { data: targets } = await service.from('profiles').select('id').in('role', ['agent', 'super_agent']);
    targetIds = (targets ?? []).map(t => t.id);
  }

  if (targetIds.length === 0) return NextResponse.json({ error: 'No Recipients Found' }, { status: 400 });

  const messages = targetIds.map(rid => ({
    sender_id: user.id,
    receiver_id: rid,
    subject,
    body: msgBody,
    type: 'broadcast' as const,
    is_broadcast: true,
  }));

  const { error } = await service.from('internal_messages').insert(messages);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, count: targetIds.length });
}
