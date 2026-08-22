import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyPaymentReminder } from '@/lib/notify';

/** POST: Send payment reminder for an overdue invoice */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createAdminClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin Only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { invoiceMessageId } = body;
  if (!invoiceMessageId) return NextResponse.json({ error: 'Missing invoiceMessageId' }, { status: 400 });

  // Look up the original invoice
  const { data: invoice, error: fetchError } = await service
    .from('internal_messages')
    .select('receiver_id, subject, invoice_amount, invoice_status')
    .eq('id', invoiceMessageId)
    .eq('type', 'invoice')
    .maybeSingle();

  if (fetchError || !invoice) return NextResponse.json({ error: 'Invoice Not Found' }, { status: 404 });
  if (invoice.invoice_status === 'paid') return NextResponse.json({ error: 'Invoice Already Paid' }, { status: 400 });

  // Send reminder message FIRST - if this fails, status remains unchanged (no orphan)
  const { error: sendError } = await service.from('internal_messages').insert({
    sender_id: user.id,
    receiver_id: invoice.receiver_id,
    subject: `Payment Reminder - ${invoice.subject}`,
    body: `This is a reminder that your invoice "${invoice.subject}" ($${Number(invoice.invoice_amount || 0).toFixed(2)}) is overdue.

Please remit payment as soon as possible to avoid any service interruptions.`,
    type: 'payment_reminder',
  });

  if (sendError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  // In-app notification - shows in bell immediately
  await notifyPaymentReminder(
    service,
    invoice.receiver_id,
    invoice.subject ?? 'Invoice',
    Number(invoice.invoice_amount || 0),
  ).catch(() => { /* best-effort */ });

  // Mark invoice as overdue only after the message has been delivered successfully
  await service.from('internal_messages')
    .update({ invoice_status: 'overdue' })
    .eq('id', invoiceMessageId);

  return NextResponse.json({ success: true });
}
