import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Create = z.object({
  researcherId: z.string().uuid(),
  title: z.string().min(1).max(200),
  remindAt: z.string().datetime(),
});
const Update = z.object({
  id: z.string().uuid(),
  completed: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
  remindAt: z.string().datetime().optional(),
});
const Del = z.object({ id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const parsed = Create.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  try {
    const svc = await createServiceClient();
    const { data, error } = await svc
      .from('agent_researcher_reminders')
      .insert({ agent_id: gate.user.id, researcher_id: parsed.data.researcherId, title: parsed.data.title, remind_at: parsed.data.remindAt })
      .select('id').maybeSingle();
    if (error) return NextResponse.json({ error: 'Could Not Save Reminder' }, { status: 500 });
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('[researchers/reminders] POST error:', err);
    return NextResponse.json({ error: 'Failed To Save Reminder' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const parsed = Update.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  try {
    const svc = await createServiceClient();
    const patch: Record<string, unknown> = {};
    if (parsed.data.completed !== undefined) {
      patch.completed_at = parsed.data.completed ? new Date().toISOString() : null;
    }
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.remindAt !== undefined) patch.remind_at = parsed.data.remindAt;
    await svc.from('agent_researcher_reminders').update(patch).eq('id', parsed.data.id).eq('agent_id', gate.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[researchers/reminders] PATCH error:', err);
    return NextResponse.json({ error: 'Failed To Update Reminder' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const parsed = Del.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  try {
    const svc = await createServiceClient();
    await svc.from('agent_researcher_reminders').delete().eq('id', parsed.data.id).eq('agent_id', gate.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[researchers/reminders] DELETE error:', err);
    return NextResponse.json({ error: 'Failed To Delete Reminder' }, { status: 500 });
  }
}
