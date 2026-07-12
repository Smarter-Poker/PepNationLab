import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function gateAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = await createServiceClient();
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ok: true as const, userId: user.id, svc };
}

const NoteBody = z.object({ body: z.string().trim().min(1).max(2000) });

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await gateAdmin();
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid Id' }, { status: 400 });
  const { data, error } = await g.svc
    .from('messenger_support_internal_notes')
    .select('id, conversation_id, author_id, body, created_at, profiles:author_id(full_name, username)')
    .eq('conversation_id', id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Failed To Load Notes' }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const g = await gateAdmin();
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid Id' }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  const parsed = NoteBody.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Body Required' }, { status: 400 });

  const { data, error } = await g.svc
    .from('messenger_support_internal_notes')
    .insert({ conversation_id: id, author_id: g.userId, body: parsed.data.body })
    .select('id, conversation_id, author_id, body, created_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Failed To Save Note' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Note Saved But Could Not Be Retrieved' }, { status: 500 });

  await g.svc.from('admin_audit_log').insert({
    actor_id: g.userId,
    action: 'support_internal_note_add',
    entity_type: 'messenger_conversations',
    entity_id: id,
    changes: { note_id: data.id },
  });

  return NextResponse.json({ note: data });
}
