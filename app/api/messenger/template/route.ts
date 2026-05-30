import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { TemplateActionSchema } from '@/lib/messenger/schemas';

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
  const parsed = TemplateActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();

  if (parsed.data.action === 'create') {
    const { data: inserted, error: insErr } = await svc
      .from('messenger_templates')
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category ?? 'general',
        shortcut: parsed.data.shortcut ?? null,
      })
      .select('*')
      .maybeSingle();
    if (insErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    return NextResponse.json({ template: inserted });
  }

  if (parsed.data.action === 'update') {
    const { data: existing } = await svc
      .from('messenger_templates')
      .select('id, user_id')
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.body !== undefined) patch.body = parsed.data.body;
    if (parsed.data.category !== undefined) patch.category = parsed.data.category;
    if (parsed.data.shortcut !== undefined) patch.shortcut = parsed.data.shortcut;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No Fields To Update' }, { status: 400 });
    }
    const { data: updated, error: upErr } = await svc
      .from('messenger_templates')
      .update(patch)
      .eq('id', parsed.data.id)
      .select('*')
      .maybeSingle();
    if (upErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    return NextResponse.json({ template: updated });
  }

  if (parsed.data.action === 'use') {
    const { data: existingUse } = await svc
      .from('messenger_templates')
      .select('id, user_id, usage_count')
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (!existingUse) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    if (existingUse.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const nextCount = (existingUse.usage_count as number | null ?? 0) + 1;
    const { error: upErr } = await svc
      .from('messenger_templates')
      .update({ usage_count: nextCount })
      .eq('id', parsed.data.id);
    if (upErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    return NextResponse.json({ ok: true, usage_count: nextCount });
  }

  const { data: existing } = await svc
    .from('messenger_templates')
    .select('id, user_id')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ ok: true, removed: 0 });
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { error: delErr } = await svc
    .from('messenger_templates')
    .delete()
    .eq('id', parsed.data.id);
  if (delErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ ok: true, removed: 1 });
}
