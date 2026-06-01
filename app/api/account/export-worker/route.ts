// R24 phase 6 — Account data-export worker.
// Picks up one queued job and assembles a JSON dump for the user.
// Authorized via CRON_SECRET; runs hourly via Vercel cron.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = req.headers.get('Authorization') || req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const { data: job } = await svc
    .from('account_export_jobs')
    .select('id, user_id')
    .eq('status', 'queued')
    .order('requested_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) return NextResponse.json({ ok: true, processed: 0 });

  await svc.from('account_export_jobs').update({ status: 'running' }).eq('id', job.id);

  try {
    const [profile, orders, statements, balanceTxns, addresses, disclaimers] = await Promise.all([
      svc.from('profiles').select('*').eq('id', job.user_id).maybeSingle(),
      svc.from('orders').select('id, agent_id, status, total, created_at').or(`buyer_id.eq.${job.user_id},agent_id.eq.${job.user_id}`),
      svc.from('weekly_statements').select('*').eq('agent_id', job.user_id),
      svc.from('balance_transactions').select('*').eq('agent_id', job.user_id),
      svc.from('saved_addresses').select('*').eq('user_id', job.user_id),
      svc.from('disclaimer_acceptances').select('*').eq('user_id', job.user_id),
    ]);

    const dump = {
      profile: profile?.data,
      orders: orders?.data ?? [],
      statements: statements?.data ?? [],
      balance_transactions: balanceTxns?.data ?? [],
      addresses: addresses?.data ?? [],
      disclaimer_acceptances: disclaimers?.data ?? [],
      exported_at: new Date().toISOString(),
    };

    const filename = `account-export-${job.user_id}-${Date.now()}.json`;
    const buf = new TextEncoder().encode(JSON.stringify(dump, null, 2));
    const { error: upErr } = await svc.storage
      .from('account-exports')
      .upload(filename, buf, { contentType: 'application/json', upsert: true });

    if (upErr) {
      await svc.from('account_export_jobs').update({ status: 'failed' }).eq('id', job.id);
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    await svc.from('account_export_jobs').update({
      status: 'completed',
      file_path: filename,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);

    return NextResponse.json({ ok: true, processed: 1, job_id: job.id, file: filename });
  } catch (e: any) {
    await svc.from('account_export_jobs').update({ status: 'failed' }).eq('id', job.id);
    return NextResponse.json({ ok: false, error: e?.message ?? 'failed' }, { status: 500 });
  }
}
