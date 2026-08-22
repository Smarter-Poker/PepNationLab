export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { EDITABLE_TEMPLATES, invalidateTemplateCache } from '@/lib/email-overrides';

/**
 * Admin Email Center - template editor backend.
 *
 * GET -> { templates: [{...def, subject, body, updated_at}] }  (override
 *        fields are null when the code default is in effect)
 * PUT -> { key, subject, body }  empty/omitted field clears that override
 *        (falls back to the code default). Cache is invalidated so the next
 *        send uses the new copy immediately.
 */

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const supabase = await createServiceClient();

  const { data: rows } = await supabase
    .from('email_template_overrides')
    .select('key, subject, body, updated_at');
  const byKey = new Map((rows ?? []).map((r) => [r.key as string, r]));

  const templates = EDITABLE_TEMPLATES.map((def) => {
    const o = byKey.get(def.key);
    return {
      ...def,
      subject: o?.subject ?? null,
      body: o?.body ?? null,
      updated_at: o?.updated_at ?? null,
    };
  });

  return NextResponse.json({ templates });
}

export async function PUT(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }

  const key = String(body?.key ?? '');
  if (!EDITABLE_TEMPLATES.some((t) => t.key === key)) {
    return NextResponse.json({ error: 'Unknown Template.' }, { status: 400 });
  }

  const subject = typeof body?.subject === 'string' && body.subject.trim() ? body.subject.trim().slice(0, 200) : null;
  const text = typeof body?.body === 'string' && body.body.trim() ? body.body.trim().slice(0, 4000) : null;

  const supabase = await createServiceClient();

  if (subject === null && text === null) {
    // Both cleared -> remove the row entirely; the code default applies.
    const { error } = await supabase.from('email_template_overrides').delete().eq('key', key);
    if (error) return NextResponse.json({ error: 'Could Not Reset The Template.' }, { status: 500 });
  } else {
    const { error } = await supabase
      .from('email_template_overrides')
      .upsert({ key, subject, body: text, updated_by: gate.userId, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: 'Could Not Save The Template.' }, { status: 500 });
  }

  invalidateTemplateCache();
  return NextResponse.json({ success: true, key, reset: subject === null && text === null });
}
