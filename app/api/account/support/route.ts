import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

// Support ticket intake. Tickets persist in public.support_requests (RLS-scoped
// to the opener; admins can read all). Email is disabled platform-wide, so this
// in-app queue is the durable channel for help requests.
const CATEGORIES = ['general', 'order', 'payment', 'technical', 'compliance', 'account'] as const;

const SupportSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  category: z.enum(CATEGORIES).optional().default('general'),
  message: z.string().trim().min(10).max(4000),
});

const SELECT_COLS = 'id, subject, category, message, status, created_at';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('support_requests')
    .select(SELECT_COLS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  }
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SupportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { subject, category, message } = parsed.data;

  const { data, error } = await supabase
    .from('support_requests')
    .insert({ user_id: user.id, subject, category, message })
    .select(SELECT_COLS)
    .single();

  if (error) {
    return NextResponse.json({ error: 'submit_failed' }, { status: 500 });
  }

  return NextResponse.json({ ticket: data });
}
