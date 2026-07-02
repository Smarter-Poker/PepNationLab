import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export async function GET(req: Request) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const agentId = gate.user.id;
    const supabase = createAdminClient();

    // Statements from admin (top-level agents + super-agents)
    const { data: weekly, error: stmtErr } = await supabase
      .from('weekly_statements')
      .select('id, week_start, week_end, total_cogs, total_shipping, total_owed, status, due_date, paid_at, payment_method')
      .eq('agent_id', agentId)
      .order('week_start', { ascending: false })
      .limit(100);
    if (stmtErr) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    // Invoices from super-agent (sub-agents)
    const { data: invoices, error: invErr } = await supabase
      .from('agent_invoices')
      .select('id, super_agent_id, week_start, week_end, total_cogs, total_shipping, total_owed, status, due_date, paid_at, payment_method')
      .eq('agent_id', agentId)
      .order('week_start', { ascending: false })
      .limit(100);
    if (invErr) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    // Unified shape - target_type tells the UI which path to use for Pay Now
    // and which API the print view hits.
    const merged = [
      ...(weekly ?? []).map((s) => ({
        ...s,
        total_cogs: Number(s.total_cogs || 0),
        total_shipping: Number(s.total_shipping || 0),
        total_owed: Number(s.total_owed || 0),
        target_type: 'statement' as const,
        bills_from: 'admin' as const,
      })),
      ...(invoices ?? []).map((i) => ({
        ...i,
        total_cogs: Number(i.total_cogs || 0),
        total_shipping: Number(i.total_shipping || 0),
        total_owed: Number(i.total_owed || 0),
        target_type: 'agent_invoice' as const,
        bills_from: 'super_agent' as const,
      })),
    ].sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)));

    return NextResponse.json({ statements: merged, data: merged });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
