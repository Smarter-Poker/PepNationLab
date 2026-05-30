import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/** GET: List invoices | PATCH: Update invoice status */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  let query = service
    .from('internal_messages')
    .select('*, sender_profile:profiles!internal_messages_sender_id_fkey(full_name, email, username), receiver_profile:profiles!internal_messages_receiver_id_fkey(full_name, email, username)')
    .in('type', ['invoice', 'credit_memo', 'payment_reminder'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Non-admin only sees their own invoices
  if (profile?.role !== 'admin') {
    query = query.eq('receiver_id', user.id);
  }

  if (status) {
    query = query.eq('invoice_status', status);
  }

  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ invoices: data });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin Only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { messageId, status } = body;
  if (!messageId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
  if (!validStatuses.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  // B-06: Enforce invoice state machine — fetch current status first
  const { data: current, error: fetchErr } = await service
    .from('internal_messages')
    .select('invoice_status')
    .eq('id', messageId)
    .in('type', ['invoice', 'credit_memo'])
    .single();
  if (fetchErr || !current) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const currentStatus = current.invoice_status as string;
  // Define allowed transitions: paid invoices can only be cancelled (reversal).
  // Cancelled invoices cannot be re-opened to paid/overdue.
  const BLOCKED: Record<string, string[]> = {
    paid: ['pending', 'overdue'],        // can't re-open a settled invoice
    cancelled: ['paid', 'overdue'],      // can't re-open a cancelled invoice to financial states
  };
  if (BLOCKED[currentStatus]?.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition invoice from '${currentStatus}' to '${status}'.` },
      { status: 422 }
    );
  }

  // Update the invoice
  const { data: invoice, error: updateError } = await service
    .from('internal_messages')
    .update({ invoice_status: status })
    .eq('id', messageId)
    .in('type', ['invoice', 'credit_memo'])
    .select('receiver_id, invoice_amount, subject')
    .single();

  if (updateError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  // Send notification to the receiver
  if (invoice) {
    await service.from('internal_messages').insert({
      sender_id: user.id,
      receiver_id: invoice.receiver_id,
      subject: `Invoice Status Updated: ${status.toUpperCase()}`,
      body: `Your invoice "${invoice.subject}" has been marked as ${status}${invoice.invoice_amount ? ` ($${Number(invoice.invoice_amount).toFixed(2)})` : ''}.`,
      type: 'notification',
    });
  }

  return NextResponse.json({ success: true });
}
