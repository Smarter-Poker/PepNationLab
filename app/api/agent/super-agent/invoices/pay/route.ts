import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const superAgentId = gate.user.id;
    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    return withIdempotency({
      userId: superAgentId,
      route: '/api/agent/super-agent/invoices/pay',
      key: readIdempotencyKey(req),
      request: { invoice_id },
      handler: async () => {
    const supabase = await createServiceClient();

    // Verify the caller is the super_agent for this invoice, or an admin
    const { data: invoice, error: invoiceError } = await supabase
      .from('agent_invoices')
      .select('id, super_agent_id, status')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Only the super_agent who issued the invoice can mark it paid
    if (invoice.super_agent_id !== superAgentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // B-07: Only open invoices can be marked paid - prevent re-paying settled/cancelled invoices
    if (invoice.status !== 'open') {
      return NextResponse.json(
        { error: `Invoice cannot be marked paid (current status: ${invoice.status}).` },
        { status: 422 }
      );
    }

    // Update the invoice status
    const { error: updateError } = await supabase
      .from('agent_invoices')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', invoice_id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Invoice marked as paid' });
      },
    });

  } catch (error) {
    console.error('Invoice Payment Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
