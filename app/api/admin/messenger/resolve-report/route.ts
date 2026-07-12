import { z } from "zod";
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAdmin } from '@/lib/admin-auth';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { ResolveReportSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


const POSTBodySchema = z.any();

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const limited = await messengerRateLimit('admin', gate.userId);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  
  const __rawBody = await req.json().catch(() => ({}));
  const __bodyParse = POSTBodySchema.safeParse(__rawBody);
  if (!__bodyParse.success) {
    return NextResponse.json({ error: "Invalid Request Body", details: __bodyParse.error.issues }, { status: 400 });
  }
  const body = __bodyParse.data;

  const parsed = ResolveReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const { reportId, status, note } = parsed.data;
  const svc = await createServiceClient();

  const { data: row, error: updErr } = await svc
    .from('messenger_reports')
    .update({
      status,
      resolved_by: gate.userId,
      resolved_at: new Date().toISOString(),
      resolution_note: note ?? null,
    })
    .eq('id', reportId)
    .select('id, reporter_id, message_id, conversation_id, reason, note, status, resolved_by, resolved_at, resolution_note, created_at')
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Report Not Found' }, { status: 404 });
  }

  // Best-effort audit log. Failure here must not roll back the moderation action.
  await svc.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: `messenger_report_${status}`,
    entity_type: 'messenger_report',
    entity_id: reportId,
    changes: { status, note: note ?? null },
  });

  return NextResponse.json({ report: row });
}
