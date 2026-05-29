import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/researcher/rma/[id]
 * Returns the full RMA detail (request, items, attachments with signed URLs)
 * for the current researcher. Only the requester can fetch the row.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  const { data: rma, error: rmaErr } = await service
    .from('rma_requests')
    .select(`
      id, order_id, requester_id, status, reason_category, reason_details, requested_resolution,
      return_label_url, return_tracking_number, return_label_purchased_at,
      received_at, inspected_at, inspection_notes, restock_decision,
      resolution_type, resolved_at, rejected_reason,
      created_at, updated_at
    `)
    .eq('id', id)
    .single();

  if (rmaErr || !rma) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (rma.requester_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [{ data: items }, { data: attachments }] = await Promise.all([
    service.from('rma_items').select('id, product_name, quantity, unit_amount, condition_received, order_item_id').eq('rma_id', id),
    service.from('rma_attachments').select('id, storage_key, mime_type, size_bytes, uploaded_at').eq('rma_id', id).order('uploaded_at', { ascending: false }),
  ]);

  const enrichedAttachments = await Promise.all(
    (attachments ?? []).map(async (row) => {
      const { data: signed } = await service.storage
        .from('rma-attachments')
        .createSignedUrl(row.storage_key, 600);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({
    rma,
    items: items ?? [],
    attachments: enrichedAttachments,
  });
}
