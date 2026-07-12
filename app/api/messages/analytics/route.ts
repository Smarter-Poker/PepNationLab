// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** GET: Admin messaging analytics - last 7 days */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin Only' }, { status: 403 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Total messages last 7 days
  const { count: totalMessages } = await service
    .from('internal_messages')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo);

  // Invoice stats
  const { count: totalInvoices } = await service
    .from('internal_messages')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'invoice');

  const { count: pendingInvoices } = await service
    .from('internal_messages')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'invoice')
    .eq('invoice_status', 'pending');

  const { count: paidInvoices } = await service
    .from('internal_messages')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'invoice')
    .eq('invoice_status', 'paid');

  const { count: overdueInvoices } = await service
    .from('internal_messages')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'invoice')
    .eq('invoice_status', 'overdue');

  // Total invoice amount pending
  const { data: pendingAmounts } = await service
    .from('internal_messages')
    .select('invoice_amount')
    .eq('type', 'invoice')
    .eq('invoice_status', 'pending');
  const totalPending = (pendingAmounts ?? []).reduce((sum, i) => sum + Number(i.invoice_amount || 0), 0);

  // Total paid amount
  const { data: paidAmounts } = await service
    .from('internal_messages')
    .select('invoice_amount')
    .eq('type', 'invoice')
    .eq('invoice_status', 'paid');
  const totalPaid = (paidAmounts ?? []).reduce((sum, i) => sum + Number(i.invoice_amount || 0), 0);

  // Messages by day (last 7 days)
  const { data: recentMessages } = await service
    .from('internal_messages')
    .select('created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at');

  const byDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    byDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const m of recentMessages ?? []) {
    const day = m.created_at.slice(0, 10);
    if (byDay[day] !== undefined) byDay[day]++;
  }
  const messagesByDay = Object.entries(byDay).map(([date, count]) => ({ date, count }));

  // Top agents by message volume
  const { data: topSenders } = await service
    .from('internal_messages')
    .select('sender_id, sender_profile:profiles!internal_messages_sender_id_fkey(full_name, username)')
    .gte('created_at', sevenDaysAgo)
    .neq('sender_id', user.id);

  const senderCounts: Record<string, { name: string; count: number }> = {};
  for (const m of topSenders ?? []) {
    const name = (m as any).sender_profile?.full_name || (m as any).sender_profile?.username || 'Unknown';
    if (!senderCounts[m.sender_id]) senderCounts[m.sender_id] = { name, count: 0 }; // @ts-ignore
    senderCounts[m.sender_id].count++; // @ts-ignore
  }
  const topAgents = Object.values(senderCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return NextResponse.json({
    totalMessages: totalMessages ?? 0,
    totalInvoices: totalInvoices ?? 0,
    pendingInvoices: pendingInvoices ?? 0,
    paidInvoices: paidInvoices ?? 0,
    overdueInvoices: overdueInvoices ?? 0,
    totalPending,
    totalPaid,
    messagesByDay,
    topAgents,
  });
}
