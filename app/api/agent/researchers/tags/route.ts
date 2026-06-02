import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  researcherId: z.string().uuid(),
  tag: z.string().min(1).max(32),
  color: z.string().max(20).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  const svc = await createServiceClient();
  await svc.from('agent_researcher_tags').upsert(
    {
      agent_id: gate.user.id,
      researcher_id: parsed.data.researcherId,
      tag: parsed.data.tag.trim(),
      color: parsed.data.color ?? null,
    },
    { onConflict: 'agent_id,researcher_id,tag' },
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  const svc = await createServiceClient();
  await svc
    .from('agent_researcher_tags')
    .delete()
    .eq('agent_id', gate.user.id)
    .eq('researcher_id', parsed.data.researcherId)
    .eq('tag', parsed.data.tag.trim());
  return NextResponse.json({ ok: true });
}
