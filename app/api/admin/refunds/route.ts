import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const service = await createServiceClient();

  const { data, error } = await service
    .from('refunds')
    .select('id, order_id, amount, reason, refund_type, status, approved_by, approved_at, completed_at, is_partial, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const approverIds = Array.from(new Set((data ?? []).map((r: any) => r.approved_by).filter(Boolean)));
  const approverNames: Record<string, string> = {};
  if (approverIds.length) {
    const { data: profs } = await service
      .from('profiles')
      .select('id, full_name, email')
      .in('id', approverIds as string[]);
    profs?.forEach((p: any) => {
      approverNames[p.id] = p.full_name || (p.email ? `@${p.email.split('@')[0]}` : p.id.slice(0, 8));
    });
  }

  return NextResponse.json({ data, approverNames });
}
