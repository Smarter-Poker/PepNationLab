import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getCachedUser } from '@/lib/supabase/server';
import { EDITABLE_TEMPLATES } from '@/lib/email-overrides';

async function requireAdmin() {
  const { user } = await getCachedUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (data?.role !== 'admin') return null;
  return { user, admin };
}

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch all saved overrides from the DB
  const { data: rows } = await ctx.admin
    .from('email_template_overrides')
    .select('key, subject, body, updated_at');

  const overrideMap = Object.fromEntries(
    (rows ?? []).map((r: { key: string; subject: string | null; body: string | null; updated_at: string | null }) => [r.key, r])
  );

  // Merge EDITABLE_TEMPLATES definition with any saved overrides
  const templates = EDITABLE_TEMPLATES.map((t) => {
    const saved = overrideMap[t.key];
    return {
      template_key: t.key,
      label: t.label,
      description: t.description,
      available_vars: t.vars,
      default_subject: t.defaultSubject,
      default_body: t.defaultBody,
      subject_override: saved?.subject ?? null,
      body_override: saved?.body ?? null,
      updated_at: saved?.updated_at ?? null,
    };
  });

  return NextResponse.json({ templates });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { template_key, subject_override, body_override } = body ?? {};
  if (!template_key) return NextResponse.json({ error: 'template_key required' }, { status: 400 });

  // Verify key is in our registry
  const known = EDITABLE_TEMPLATES.find((t) => t.key === template_key);
  if (!known) return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });

  const subjectVal = subject_override?.trim() || null;
  const bodyVal = body_override?.trim() || null;

  if (!subjectVal && !bodyVal) {
    // Clearing both = delete the row
    await ctx.admin.from('email_template_overrides').delete().eq('key', template_key);
    return NextResponse.json({ template: { template_key, subject_override: null, body_override: null, updated_at: null } });
  }

  const { data, error } = await ctx.admin
    .from('email_template_overrides')
    .upsert({
      key: template_key,
      subject: subjectVal,
      body: bodyVal,
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    template: {
      template_key: data.key,
      subject_override: data.subject,
      body_override: data.body,
      updated_at: data.updated_at,
    },
  });
}
