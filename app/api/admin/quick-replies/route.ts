import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function gateAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = await createServiceClient();
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ok: true as const, userId: user.id, svc };
}

const Body = z.object({
  slash_key: z.string().trim().regex(/^[a-z0-9_-]{1,32}$/, 'lowercase alphanumeric/underscore/hyphen only'),
  label: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(4000),
});

export async function GET() {
  const g = await gateAdmin();
  if (!g.ok) return g.response;
  const { data, error } = await g.svc
    .from('messenger_support_quick_replies')
    .select('id, slash_key, label, body, created_at, updated_at')
    .eq('user_id', g.userId)
    .order('slash_key', { ascending: true });
  if (error) return NextResponse.json({ error: 'Failed To Load Quick Replies' }, { status: 500 });
  return NextResponse.json({ quick_replies: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const g = await gateAdmin();
  if (!g.ok) return g.response;

  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid Payload' }, { status: 400 });

  const { data, error } = await g.svc
    .from('messenger_support_quick_replies')
    .upsert(
      { user_id: g.userId, slash_key: parsed.data.slash_key, label: parsed.data.label, body: parsed.data.body, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,slash_key' },
    )
    .select('id, slash_key, label, body, created_at, updated_at')
    .single();
  if (error) return NextResponse.json({ error: 'Failed To Save Quick Reply' }, { status: 500 });
  return NextResponse.json({ quick_reply: data });
}
