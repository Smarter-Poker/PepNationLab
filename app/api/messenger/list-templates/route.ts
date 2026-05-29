import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const svc = await createServiceClient();

  const { data, error: qErr } = await svc
    .from('messenger_templates')
    .select('id, title, body, category, shortcut, usage_count, created_at')
    .eq('user_id', user.id)
    .order('usage_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  return NextResponse.json({ templates: data ?? [] });
}
