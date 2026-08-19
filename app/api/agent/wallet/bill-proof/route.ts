import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { safeError } from '@/lib/api-error';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Payment proof for a BILL (a weekly statement or an agent invoice).
 *
 * payment_proofs was order-only until now, which is why pay_invoice accepted a
 * proof id and silently discarded it - there was nothing a statement proof
 * could have been. Mirrors app/api/researcher/payment-proof for orders: same
 * bucket, same limits, same signed-URL read path.
 *
 * POST (multipart: file + targetType + targetId) -> { proofId }
 * GET  (?targetType=&targetId=)                  -> proofs with signed URLs
 */

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']);
const MAX_BYTES = 10 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'application/pdf': 'pdf',
};

type TargetType = 'statement' | 'agent_invoice';

/** Resolve the bill and confirm this caller is the one who owes it. */
async function loadBill(svc: any, targetType: TargetType, targetId: string) {
  if (targetType === 'statement') {
    const { data } = await svc
      .from('weekly_statements')
      .select('id, agent_id, status, total_owed')
      .eq('id', targetId)
      .maybeSingle();
    return data ? { id: data.id, payerId: data.agent_id, status: data.status } : null;
  }
  const { data } = await svc
    .from('agent_invoices')
    .select('id, agent_id, status, total_owed')
    .eq('id', targetId)
    .maybeSingle();
  return data ? { id: data.id, payerId: data.agent_id, status: data.status } : null;
}

function parseTarget(v: unknown): TargetType | null {
  return v === 'statement' || v === 'agent_invoice' ? v : null;
}

export async function GET(req: NextRequest) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const targetType = parseTarget(req.nextUrl.searchParams.get('targetType'));
  const targetId = req.nextUrl.searchParams.get('targetId');
  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'Missing Bill Reference.' }, { status: 400 });
  }

  const svc = await createServiceClient();
  const bill = await loadBill(svc, targetType, targetId);
  if (!bill) return NextResponse.json({ error: 'Bill Not Found.' }, { status: 404 });

  // The payer can see their own evidence. So can whoever has to confirm it -
  // resolved below - and any admin.
  const { data: me } = await svc.from('profiles').select('role, parent_agent_id').eq('id', gate.user.id).maybeSingle();
  const { data: payer } = await svc.from('profiles').select('parent_agent_id').eq('id', bill.payerId).maybeSingle();
  const isPayer = bill.payerId === gate.user.id;
  const isConfirmer = payer?.parent_agent_id === gate.user.id;
  const isAdmin = me?.role === 'admin';
  if (!isPayer && !isConfirmer && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const column = targetType === 'statement' ? 'statement_id' : 'agent_invoice_id';
  const { data, error } = await svc
    .from('payment_proofs')
    .select('id, uploader_id, storage_key, mime_type, size_bytes, uploaded_at, verified_at, verified_by')
    .eq(column, targetId)
    .order('uploaded_at', { ascending: false });

  if (error) return safeError('wallet.bill_proof.list', error, 500);

  const enriched = await Promise.all(
    (data ?? []).map(async (row: any) => {
      const { data: signed } = await svc.storage
        .from('payment-proofs')
        .createSignedUrl(row.storage_key, 600);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ proofs: enriched });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const rl = await rateLimit({ key: 'wallet_bill_proof', limit: 20, windowSeconds: 300, identifier: gate.user.id });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Uploads. Wait A Moment Then Try Again.' }, { status: 429 });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'Invalid Upload.' }, { status: 400 }); }

  const targetType = parseTarget(form.get('targetType'));
  const targetId = form.get('targetId');
  const file = form.get('file');

  if (!targetType || typeof targetId !== 'string' || !targetId) {
    return NextResponse.json({ error: 'Missing Bill Reference.' }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: 'A File Is Required.' }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported File Type. Use PNG, JPG, Or PDF.' }, { status: 400 });
  }
  if (file.size <= 0) return NextResponse.json({ error: 'File Is Empty.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File Exceeds 10 MB Maximum.' }, { status: 400 });

  const svc = await createServiceClient();
  const bill = await loadBill(svc, targetType, targetId);
  if (!bill) return NextResponse.json({ error: 'Bill Not Found.' }, { status: 404 });

  // Only the account that owes the bill may submit evidence for it.
  if (bill.payerId !== gate.user.id) {
    return NextResponse.json({ error: 'This Bill Does Not Belong To Your Account.' }, { status: 403 });
  }
  if (bill.status === 'paid') {
    return NextResponse.json({ error: 'This Bill Has Already Been Paid.' }, { status: 409 });
  }

  const { count } = await svc
    .from('payment_proofs')
    .select('id', { count: 'exact', head: true })
    .eq(targetType === 'statement' ? 'statement_id' : 'agent_invoice_id', targetId);
  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: 'Upload Limit Reached For This Bill.' }, { status: 429 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const ext = EXT_BY_MIME[file.type] ?? 'bin';
  const storageKey = `bills/${targetType}/${targetId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await svc.storage
    .from('payment-proofs')
    .upload(storageKey, bytes, { contentType: file.type, upsert: false });
  if (upErr) return safeError('wallet.bill_proof.upload', upErr, 500, 'Could Not Upload That File. Please Try Again.');

  const { data: proof, error: insErr } = await svc
    .from('payment_proofs')
    .insert({
      order_id: null,
      statement_id: targetType === 'statement' ? targetId : null,
      agent_invoice_id: targetType === 'agent_invoice' ? targetId : null,
      uploader_id: gate.user.id,
      storage_key: storageKey,
      mime_type: file.type,
      size_bytes: file.size,
      content_hash: hash,
    })
    .select('id')
    .single();

  if (insErr) {
    // Do not leave an orphan object in the bucket.
    await svc.storage.from('payment-proofs').remove([storageKey]).catch(() => undefined);
    return safeError('wallet.bill_proof.insert', insErr, 500, 'Could Not Save That Proof. Please Try Again.');
  }

  return NextResponse.json({ ok: true, proofId: proof.id });
}
