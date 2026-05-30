import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

/** GET: List commissions | POST: Approve/Pay/Create payout */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const agentId = url.searchParams.get('agentId');

  let query = service
    .from('agent_commissions')
    .select('*, profiles:agent_id(full_name, email, username, commission_rate), orders:order_id(total, status, created_at)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (agentId) query = query.eq('agent_id', agentId);

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const pending = (data ?? []).filter(c => c.status === 'pending');
  const approved = (data ?? []).filter(c => c.status === 'approved');
  const paid = (data ?? []).filter(c => c.status === 'paid');

  const stats = {
    pendingCount: pending.length,
    pendingAmount: pending.reduce((s, c) => s + Number(c.commission_amount), 0),
    approvedCount: approved.length,
    approvedAmount: approved.reduce((s, c) => s + Number(c.commission_amount), 0),
    paidCount: paid.length,
    paidAmount: paid.reduce((s, c) => s + Number(c.commission_amount), 0),
    totalAll: (data ?? []).reduce((s, c) => s + Number(c.commission_amount), 0),
  };

  const agentMap: Record<string, { name: string; pending: number; paid: number; total: number }> = {};
  for (const c of data ?? []) {
    const name = (c as any).profiles?.full_name || (c as any).profiles?.email || 'Agent';
    if (!agentMap[c.agent_id]) agentMap[c.agent_id] = { name, pending: 0, paid: 0, total: 0 };
    agentMap[c.agent_id].total += Number(c.commission_amount);
    if (c.status === 'pending' || c.status === 'approved') agentMap[c.agent_id].pending += Number(c.commission_amount);
    if (c.status === 'paid') agentMap[c.agent_id].paid += Number(c.commission_amount);
  }
  const agentSummary = Object.entries(agentMap).map(([id, v]) => ({ agentId: id, ...v })).sort((a, b) => b.total - a.total);

  const { data: payouts } = await service.from('payout_records').select('*, profiles:agent_id(full_name, email)').order('created_at', { ascending: false }).limit(50);

  return NextResponse.json({ commissions: data, stats, agentSummary, payouts: payouts ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'approve') {
    const { commissionIds } = body;
    if (!commissionIds?.length) return NextResponse.json({ error: 'No IDs' }, { status: 400 });
    const { error } = await service.from('agent_commissions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .in('id', commissionIds)
      .eq('status', 'pending');
    if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    return NextResponse.json({ success: true, approved: commissionIds.length });
  }

  if (action === 'payout') {
    const { agentId, paymentMethod, referenceNumber, notes } = body;
    if (!agentId) return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });

    const { data: approvedComms } = await service.from('agent_commissions')
      .select('id, commission_amount')
      .eq('agent_id', agentId)
      .eq('status', 'approved');

    if (!approvedComms?.length) return NextResponse.json({ error: 'No Approved Commissions To Pay' }, { status: 400 });

    const totalAmount = approvedComms.reduce((s, c) => s + Number(c.commission_amount), 0);

    const { data: payout, error: payoutError } = await service.from('payout_records').insert({
      agent_id: agentId,
      amount: totalAmount,
      payment_method: paymentMethod || 'other',
      reference_number: referenceNumber || null,
      notes: notes || null,
      status: 'completed',
      completed_at: new Date().toISOString(),
      created_by: user.id,
    }).select().single();

    if (payoutError) return NextResponse.json({ error: payoutError.message }, { status: 500 });

    const commIds = approvedComms.map(c => c.id);
    await service.from('agent_commissions')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payout_id: payout.id })
      .in('id', commIds);

    await service.from('internal_messages').insert({
      sender_id: user.id,
      receiver_id: agentId,
      subject: `Commission Payout: $${totalAmount.toFixed(2)}`,
      body: `Your commission payout of $${totalAmount.toFixed(2)} has been processed via ${paymentMethod || 'transfer'}${referenceNumber ? ` (Ref: ${referenceNumber})` : ''}.`,
      type: 'notification',
    });

    await service.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'commission_payout',
      entity_type: 'payout_record',
      entity_id: payout.id,
      changes: { agent_id: agentId, total_amount: totalAmount, commission_count: commIds.length },
    });

    return NextResponse.json({ success: true, payout, commissionsMarkedPaid: commIds.length });
  }

  if (action === 'updateRate') {
    const { agentId, rate } = body;
    if (!agentId || rate === undefined) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const numRate = Number(rate);
    if (!Number.isFinite(numRate) || numRate < 0 || numRate > 100) {
      return NextResponse.json({ error: 'Rate Must Be Between 0 And 100' }, { status: 400 });
    }
    const { error } = await service.from('profiles').update({ commission_rate: numRate }).eq('id', agentId);
    if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    await service.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'commission_rate_update',
      entity_type: 'profile',
      entity_id: agentId,
      changes: { new_rate: numRate },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
