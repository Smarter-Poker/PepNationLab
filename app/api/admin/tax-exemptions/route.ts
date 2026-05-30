import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = req.nextUrl;
  const status = url.searchParams.get('status'); // pending|approved|rejected|expired|all
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const service = await createServiceClient();

  let query = service
    .from('tax_exemptions')
    .select('id, user_id, state_code, organization_name, certificate_number, mime_type, size_bytes, uploaded_at, status, approved_by, approved_at, rejected_reason, expires_at, notes, storage_key, profile:profiles!tax_exemptions_user_id_fkey(full_name, email, username)', { count: 'exact' })
    .order('uploaded_at', { ascending: false })
    .range(from, to);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const enriched = await Promise.all(
    (data ?? []).map(async (row: any) => {
      const { data: signed } = await service.storage
        .from('tax-exemption-certs')
        .createSignedUrl(row.storage_key, 600);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ data: enriched, page, pageSize, total: count ?? 0 });
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'expire']),
  rejected_reason: z.string().min(1).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Patch Payload.', details: parsed.error.issues }, { status: 400 });
  }

  const { id, action, rejected_reason, notes } = parsed.data;
  const service = await createServiceClient();

  const { data: existing, error: fetchErr } = await service
    .from('tax_exemptions')
    .select('id, user_id, state_code, organization_name, status')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Exemption Not Found.' }, { status: 404 });

  const update: Record<string, unknown> = { notes: notes ?? null };
  if (action === 'approve') {
    update.status = 'approved';
    update.approved_by = gate.userId;
    update.approved_at = new Date().toISOString();
    update.rejected_reason = null;
  } else if (action === 'reject') {
    if (!rejected_reason || !rejected_reason.trim()) {
      return NextResponse.json({ error: 'A Rejection Reason Is Required.' }, { status: 400 });
    }
    update.status = 'rejected';
    update.rejected_reason = rejected_reason.trim();
    update.approved_by = gate.userId;
    update.approved_at = new Date().toISOString();
  } else if (action === 'expire') {
    update.status = 'expired';
    update.approved_by = gate.userId;
    update.approved_at = new Date().toISOString();
  }

  const { error: updateErr } = await service
    .from('tax_exemptions')
    .update(update)
    .eq('id', id);
  if (updateErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  // Audit log
  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: `tax_exemption_${action}`,
    entity_type: 'tax_exemption',
    entity_id: id,
    changes: { state_code: existing.state_code, prior_status: existing.status, new_status: update.status, rejected_reason: update.rejected_reason ?? null },
  }).then(() => {}, () => {});

  // In-app notification to the user
  const subjectMap: Record<string, string> = {
    approve: 'Tax Exemption Approved',
    reject: 'Tax Exemption Rejected',
    expire: 'Tax Exemption Expired',
  };
  const bodyMap: Record<string, string> = {
    approve: `Your Tax Exemption Certificate For ${existing.state_code} Has Been Approved. Future Orders Shipping To That State Will Be Exempt From Sales Tax.`,
    reject: `Your Tax Exemption Certificate For ${existing.state_code} Was Rejected. Reason: ${rejected_reason ?? 'Not Specified.'} Please Submit An Updated Certificate.`,
    expire: `Your Tax Exemption Certificate For ${existing.state_code} Has Expired. Please Submit A Renewed Certificate To Continue Receiving Tax-Exempt Status.`,
  };
  await service.from('internal_messages').insert({
    sender_id: gate.userId,
    receiver_id: existing.user_id,
    subject: subjectMap[action],
    body: bodyMap[action],
    type: 'notification',
  }).then(() => {}, () => {});

  return NextResponse.json({ success: true });
}
