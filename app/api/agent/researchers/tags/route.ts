import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAgent } from '@/lib/admin-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const TagSchema = z.object({
  researcherId: z.string().uuid(),
  tag: z.string().min(1).max(50),
});

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const parsed = TagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Tag Data' }, { status: 422 });
  }
  try {
    const svc = await createServiceClient();
    await svc.from('agent_researcher_tags').upsert(
      { agent_id: gate.user.id, researcher_id: parsed.data.researcherId, tag: parsed.data.tag.toLowerCase().trim() },
      { onConflict: 'agent_id,researcher_id,tag' },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[researchers/tags] POST error:', err);
    return NextResponse.json({ error: 'Failed To Add Tag' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const parsed = TagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Tag Data' }, { status: 422 });
  }
  try {
    const svc = await createServiceClient();
    await svc.from('agent_researcher_tags').delete().eq('agent_id', gate.user.id).eq('researcher_id', parsed.data.researcherId).eq('tag', parsed.data.tag.toLowerCase().trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[researchers/tags] DELETE error:', err);
    return NextResponse.json({ error: 'Failed To Remove Tag' }, { status: 500 });
  }
}
