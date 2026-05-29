import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getImpersonationContext } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const ctx = await getImpersonationContext();
  if (!ctx || ctx.impersonatorId !== gate.userId) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    session_id: ctx.sessionId,
    target_user_id: ctx.targetUserId,
    target_role: ctx.targetRole,
    target_name: ctx.targetName,
  });
}
