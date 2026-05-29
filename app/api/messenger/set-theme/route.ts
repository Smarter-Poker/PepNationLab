import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { SetThemeSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = SetThemeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const callerPart = await getParticipant(parsed.data.conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const svc = await createServiceClient();

  const { data: existing } = await svc
    .from('messenger_themes')
    .select('id')
    .eq('conversation_id', parsed.data.conversationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { data: updated, error: upErr } = await svc
      .from('messenger_themes')
      .update({
        theme_value: parsed.data.themeValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ theme: updated });
  }

  const { data: inserted, error: insErr } = await svc
    .from('messenger_themes')
    .insert({
      conversation_id: parsed.data.conversationId,
      user_id: user.id,
      theme_value: parsed.data.themeValue,
    })
    .select('*')
    .maybeSingle();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ theme: inserted });
}
