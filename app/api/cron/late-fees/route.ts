// R24 phase 6 — Late fees daily cron.
// Marks overdue statements (due_date past, status still open) and applies the
// platform's configured grace + flat-fee schedule. Idempotent via cron_runs.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GRACE_DAYS = 3;
const FLAT_FEE = 25.00;

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Idempotency: short-circuit if already ran today
  const runName = `late_fees:${today}`;
  const { data: existing } = await svc
    .from('cron_runs')
    .select('run_name')
    .eq('run_name', runName)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, deduped: true });

  // Find overdue open statements where due_date + grace < today
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GRACE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: overdue, error } = await svc
    .from('weekly_statements')
    .select('id, agent_id, total_owed, due_date')
    .eq('status', 'open')
    .lt('due_date', cutoffStr)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let applied = 0;
  for (const stmt of overdue ?? []) {
    const { error: insErr } = await svc
      .from('balance_transactions')
      .insert({
        agent_id: stmt.agent_id,
        type: 'adjustment',
        amount: FLAT_FEE,
        balance_before: 0,
        balance_after: 0,
        description: `Late fee on statement ${stmt.id}`,
        reference_id: stmt.id,
        reference_type: 'statement',
      });
    if (!insErr) applied++;
  }

  await svc.from('cron_runs').insert({ run_name: runName, payload: { applied } });
  return NextResponse.json({ ok: true, applied });
}
