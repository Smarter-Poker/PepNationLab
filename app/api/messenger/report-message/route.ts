import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { ReportMessageSchema } from '@/lib/messenger/schemas';

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
  const parsed = ReportMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const { messageId, reason, note } = parsed.data;
  const svc = await createServiceClient();

  const { data: msg } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, sender_id')
    .eq('id', messageId)
    .maybeSingle();

  if (!msg) {
    return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });
  }
  if (msg.sender_id === user.id) {
    return NextResponse.json({ error: 'Cannot Report Own Message' }, { status: 400 });
  }

  const part = await getParticipant(msg.conversation_id as string, user.id);
  if (!part) {
    return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });
  }

  const { data: row, error: insErr } = await svc
    .from('messenger_reports')
    .insert({
      reporter_id: user.id,
      message_id: messageId,
      conversation_id: msg.conversation_id,
      reason,
      note: note ?? null,
      status: 'open',
    })
    .select('id, reporter_id, message_id, conversation_id, reason, note, status, created_at')
    .maybeSingle();

  if (insErr) {
    // Audit7 fix: surface duplicate-report (UNIQUE(message_id, reporter_id))
    // as a clean 409 rather than a 500. The DB unique constraint added in
    // messenger_audit7_phase12_reports_unique stops the same user from
    // submitting two reports against the same message; reflect that at the
    // API boundary so the client can show "Already Reported".
    if ((insErr as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'Already Reported' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ report: row });
}
