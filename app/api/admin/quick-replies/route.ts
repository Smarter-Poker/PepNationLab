import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  slash_key: z.string().trim().regex(/^[a-z0-9_-]{1,32}$/, 'lowercase alphanumeric/underscore/hyphen only'),
  label: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(4000),
});

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('messenger_support_quick_replies')
    .select('id, slash_key, label, body, created_at, updated_at')
    .eq('user_id', gate.userId)
    .order('slash_key', { ascending: true });
  if (error) return NextResponse.json({ error: 'Failed To Load Quick Replies' }, { status: 500 });
  return NextResponse.json({ quick_replies: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid Payload' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('messenger_support_quick_replies')
    .upsert(
      { user_id: gate.userId, slash_key: parsed.data.slash_key, label: parsed.data.label, body: parsed.data.body, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,slash_key' },
    )
    .select('id, slash_key, label, body, created_at, updated_at')
    .single();
  if (error) return NextResponse.json({ error: 'Failed To Save Quick Reply' }, { status: 500 });
  return NextResponse.json({ quick_reply: data });
}
