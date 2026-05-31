import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { ListParticipantsSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = ListParticipantsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const svc = await createServiceClient();

  // Audit fix (Phase 9): include `settings` so the UI can render the caller's
  // per-participant flags (archived, etc.) without an extra round trip.
  // Other participants' settings are not sensitive (per-participant prefs),
  // but we still scrub them out before returning so only the caller sees their own.
  const { data: partsData, error: qErr } = await svc
    .from('messenger_participants')
    .select('id, user_id, role, joined_at, last_read_message_id, settings')
    .eq('conversation_id', parsed.data.conversationId)
    .order('joined_at', { ascending: true });

  if (qErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const participants = partsData ?? [];
  const userIds = participants.map((p) => p.user_id);
  
  let profilesMap: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: profs } = await svc
      .from('profiles')
      .select('id, full_name, username, role, email')
      .in('id', userIds);
      
    if (profs) {
      profs.forEach((p) => {
        profilesMap[p.id] = p;
      });
    }
  }

  type Row = {
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
    last_read_message_id: string | null;
    settings: Record<string, unknown> | null;
  };
  
  const flat = (participants as unknown as Row[]).map((r) => {
    const profile = profilesMap[r.user_id] || null;
    return {
      id: r.id,
      user_id: r.user_id,
      role: r.role,
      joined_at: r.joined_at,
      // Only return settings for the caller's own participant row.
      settings: r.user_id === user.id ? (r.settings ?? {}) : null,
      full_name: profile?.full_name ?? null,
      username: profile?.username ?? null,
      profile_role: profile?.role ?? null,
      email: profile?.email ?? null,
      last_read_message_id: r.last_read_message_id,
    };
  });

  return NextResponse.json({ participants: flat });
}
