import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/researchers/notes
 * Body: { researcherId: string, note: string }
 *
 * Upserts the calling agent's private CRM note for one of their researchers.
 * The researcher must belong to this agent (referring_agent_id = caller).
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const agentId = gate.user.id;

  const body = await req.json().catch(() => ({}));
  const researcherId = typeof body.researcherId === 'string' ? body.researcherId : '';
  const noteRaw = typeof body.note === 'string' ? body.note : '';

  if (!researcherId) {
    return NextResponse.json({ error: 'Researcher Is Required.' }, { status: 400 });
  }
  const note = noteRaw.slice(0, 4000);

  try {
    const svc = await createServiceClient();

    const { data: researcher } = await svc
      .from('profiles')
      .select('id, referring_agent_id')
      .eq('id', researcherId)
      .eq('role', 'researcher')
      .maybeSingle();

    if (!researcher || researcher.referring_agent_id !== agentId) {
      return NextResponse.json({ error: 'Researcher Not Found.' }, { status: 404 });
    }

    const { error } = await svc
      .from('agent_researcher_notes')
      .upsert(
        {
          agent_id: agentId,
          researcher_id: researcherId,
          note,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id,researcher_id' },
      );

    if (error) {
      console.error('[crm notes] upsert error:', error.message);
      return NextResponse.json({ error: 'Failed To Save Note.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, note });
  } catch (err) {
    console.error('[researchers/notes] POST error:', err);
    return NextResponse.json({ error: 'Failed To Save Note.' }, { status: 500 });
  }
}
