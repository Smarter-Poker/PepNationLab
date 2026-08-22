import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const conversationId = body.conversationId;
  
  if (!conversationId || typeof conversationId !== 'string') {
    return NextResponse.json({ error: 'Invalid Body' }, { status: 400 });
  }

  const svc = await createServiceClient();

  const { data: partRow } = await svc
    .from('messenger_participants')
    .select('id, role')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!partRow) {
    return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });
  }

  // Soft delete for the user by setting deleted: true in their participant settings
  const { data: currentSettingsRow } = await svc
    .from('messenger_participants')
    .select('settings')
    .eq('id', partRow.id)
    .single();

  const currentSettings = (currentSettingsRow?.settings && typeof currentSettingsRow.settings === 'object' ? currentSettingsRow.settings : {}) as Record<string, unknown>;
  const nextSettings = { ...currentSettings, deleted: true };

  const { error: updErr } = await svc
    .from('messenger_participants')
    .update({ settings: nextSettings })
    .eq('id', partRow.id);

  if (updErr) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
