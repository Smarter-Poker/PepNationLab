
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const GoalSchema = z.object({
  researcherId: z.string().uuid(),
  period: z.enum(['weekly', 'monthly', 'quarterly']),
  target_orders: z.number().int().min(0).optional(),
  target_spend: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const parsed = GoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Goal Data' }, { status: 422 });
  }
  try {
    const { researcherId, ...rest } = parsed.data;
    const svc = await createServiceClient();
    await svc.from('agent_researcher_growth_goals').upsert(
      { agent_id: gate.user.id, researcher_id: researcherId, ...rest, updated_at: new Date().toISOString() }, // @ts-ignore
      { onConflict: 'agent_id,researcher_id,period' },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[researchers/goals] POST error:', err);
    return NextResponse.json({ error: 'Failed To Save Goal' }, { status: 500 });
  }
}
