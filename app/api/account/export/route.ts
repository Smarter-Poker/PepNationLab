import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const ACTIVE_STATUSES = ['queued', 'running'];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('account_export_jobs')
    .select('id, status, file_path, requested_at, completed_at')
    .eq('user_id', user.id)
    .order('requested_at', { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: 'export_list_failed' }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: active } = await supabase
    .from('account_export_jobs')
    .select('id, status, requested_at')
    .eq('user_id', user.id)
    .in('status', ACTIVE_STATUSES)
    .limit(1);

  if (active && active.length > 0) {
    return NextResponse.json(
      { error: 'An Export Is Already In Progress.', job: active[0] },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from('account_export_jobs')
    .insert({ user_id: user.id, status: 'queued' })
    .select('id, status, file_path, requested_at, completed_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'export_enqueue_failed' }, { status: 500 });
  }

  await supabase
    .rpc('log_account_event', {
      p_user_id: user.id,
      p_event: 'account_export_requested',
      p_details: { job_id: data?.id },
    })
    .then(() => null, () => null);

  return NextResponse.json({ job: data });
}
