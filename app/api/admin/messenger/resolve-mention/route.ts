import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAdmin } from '@/lib/admin-auth';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { ResolveAdminMentionSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Audit5 fix: previously the admin moderation surface could LIST @admin
// mentions but had no way to mark them read/resolved. The unread counter
// could never be cleared and the AdminMessengerClient's `handleMention*`
// stubs returned 404 because no resolve route existed. This route fills the
// gap.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const limited = await messengerRateLimit('admin', gate.userId);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = ResolveAdminMentionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { mentionId, status, note } = parsed.data;
  const svc = await createServiceClient();

  const update: Record<string, unknown> = {
    status,
    resolution_note: note ?? null,
  };
  if (status === 'resolved') {
    update.resolved_by = gate.userId;
    update.resolved_at = new Date().toISOString();
  } else {
    // status === 'read': clear any previous resolution stamp so a re-resolve
    // produces a fresh resolved_at.
    update.resolved_by = null;
    update.resolved_at = null;
  }

  const { data: row, error: updErr } = await svc
    .from('messenger_admin_messages')
    .update(update)
    .eq('id', mentionId)
    .select(
      'id, message_id, conversation_id, sender_id, message_text, status, resolved_by, resolved_at, resolution_note, created_at',
    )
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Mention Not Found' }, { status: 404 });
  }

  // Best-effort audit log entry.
  await svc.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: `messenger_mention_${status}`,
    entity_type: 'messenger_admin_mention',
    entity_id: mentionId,
    changes: { status, note: note ?? null },
  });

  return NextResponse.json({ mention: row });
}
