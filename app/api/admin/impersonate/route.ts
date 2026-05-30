import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_SECONDS,
  encodeImpersonationCookie,
  getImpersonationContext,
} from '@/lib/impersonation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const impersonatorId = gate.userId;

  let body: { target_user_id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Body' }, { status: 400 });
  }

  const targetUserId = typeof body.target_user_id === 'string' ? body.target_user_id : null;
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;
  if (!targetUserId) {
    return NextResponse.json({ error: 'Target User Required' }, { status: 400 });
  }
  if (targetUserId === impersonatorId) {
    return NextResponse.json({ error: 'Cannot Impersonate Yourself' }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: target } = await service
    .from('profiles')
    .select('id, role')
    .eq('id', targetUserId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: 'Target User Not Found' }, { status: 404 });
  }

  if (target.role === 'admin') {
    return NextResponse.json({ error: 'Cannot Impersonate Another Admin' }, { status: 403 });
  }

  await service
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('impersonator_id', impersonatorId)
    .is('ended_at', null);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const ua = req.headers.get('user-agent') ?? null;

  const { data: inserted, error: insertErr } = await service
    .from('impersonation_sessions')
    .insert({
      impersonator_id: impersonatorId,
      target_user_id: targetUserId,
      reason,
      ip_address: ip,
      user_agent: ua,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: 'Failed To Start Impersonation' }, { status: 500 });
  }

  const sessionId = inserted.id as string;

  await service.from('admin_audit_log').insert({
    actor_id: impersonatorId,
    action: 'impersonation_start',
    entity_type: 'profile',
    entity_id: targetUserId,
    changes: { session_id: sessionId, reason },
    ip_address: ip,
    user_agent: ua,
  });

  const cookieValue = encodeImpersonationCookie({
    sid: sessionId,
    imp: impersonatorId,
    tgt: targetUserId,
  });

  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: IMPERSONATION_TTL_SECONDS,
  });

  const targetRole = (target.role as string) ?? 'researcher';
  const redirectTo = targetRole === 'admin' ? '/admin' : '/dashboard';

  return NextResponse.json({
    ok: true,
    session_id: sessionId,
    redirect_to: redirectTo,
  });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const impersonatorId = gate.userId;

  const ctx = await getImpersonationContext();
  const service = await createServiceClient();

  if (ctx && ctx.impersonatorId === impersonatorId) {
    await service
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', ctx.sessionId)
      .is('ended_at', null);

    await service.from('admin_audit_log').insert({
      actor_id: impersonatorId,
      action: 'impersonation_end',
      entity_type: 'profile',
      entity_id: ctx.targetUserId,
      changes: { session_id: ctx.sessionId },
      ip_address:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        null,
      user_agent: req.headers.get('user-agent') ?? null,
    });
  }

  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
