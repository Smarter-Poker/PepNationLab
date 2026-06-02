import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  targetCount: z.number().int().min(0).max(10000),
});

/**
 * Sets (or replaces) the current-month researcher growth goal for the
 * calling agent. The page reads the goal via /api/agent/researchers/v2.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const svc = await createServiceClient();
  await svc.from('agent_researcher_growth_goals').upsert(
    {
      agent_id: gate.user.id,
      period_start: periodStart,
      period_end: periodEnd,
      target_count: parsed.data.targetCount,
    },
    { onConflict: 'agent_id,period_start' },
  );
  return NextResponse.json({ ok: true });
}
