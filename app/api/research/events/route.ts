import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Research engagement sink (monograph tabs, calculators, external-doc opens,
 * COA views). Anonymous-friendly and identity-free by design: the table has
 * no user_id and no IP column, so research engagement can never be linked to
 * an identified person. Service-role writes only; admin-only reads.
 */
const EventSchema = z.object({
  event_type: z.enum(['page_view','tab_view','calculator_used','external_doc_open','coa_view','match_result_click']),
  session_id: z.string().min(8).max(80),
  visitor_id: z.string().uuid().optional(),
  path: z.string().max(300).optional(),
  compound_slug: z.string().max(120).optional(),
  tool: z.string().max(60).optional(),
  url_host: z.string().max(120).optional(),
  detail: z.string().max(200).optional(),
});

const MAX_BODY_BYTES = 4096;

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const limited = await rateLimit({
    key: 'research_events',
    identifier: getClientIp(req),
    limit: 120,
    windowSeconds: 60,
  });
  if (!limited.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  try {
    const svc = await createServiceClient();
    await svc.from('research_events').insert({
      session_id: parsed.data.session_id,
      visitor_id: parsed.data.visitor_id ?? null,
      event_type: parsed.data.event_type,
      path: parsed.data.path ?? null,
      compound_slug: parsed.data.compound_slug ?? null,
      tool: parsed.data.tool ?? null,
      url_host: parsed.data.url_host ?? null,
      detail: parsed.data.detail ?? null,
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[research/events] POST error:', err);
    // Best-effort analytics - 204 so the client never retries endlessly.
    return new Response(null, { status: 204 });
  }
}
