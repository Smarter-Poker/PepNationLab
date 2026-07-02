import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAgent } from '@/lib/admin-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PinSchema = z.object({ researcherId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const parsed = PinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Researcher Id' }, { status: 422 });
  }
  try {
    const svc = await createServiceClient();
    await svc.from('agent_researcher_pins').upsert(
      { agent_id: gate.user.id, researcher_id: parsed.data.researcherId },
      { onConflict: 'agent_id,researcher_id' },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[researchers/pins] POST error:', err);
    return NextResponse.json({ error: 'Failed To Update Pin' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const parsed = PinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Researcher Id' }, { status: 422 });
  }
  try {
    const svc = await createServiceClient();
    await svc.from('agent_researcher_pins').delete().eq('agent_id', gate.user.id).eq('researcher_id', parsed.data.researcherId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[researchers/pins] DELETE error:', err);
    return NextResponse.json({ error: 'Failed To Remove Pin' }, { status: 500 });
  }
}
