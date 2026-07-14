import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getCachedUser } from '@/lib/supabase/server';

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
  const { data, error } = await ctx.admin
    .from('email_templates')
    .select('*')
    .order('template_key');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { template_key, subject_override, body_override } = body ?? {};
  if (!template_key) return NextResponse.json({ error: 'template_key required' }, { status: 400 });
  // Verify key exists
  const { data: existing } = await ctx.admin
    .from('email_templates')
    .select('template_key')
    .eq('template_key', template_key)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  const { data, error } = await ctx.admin
    .from('email_templates')
    .update({
      subject_override: subject_override?.trim() || null,
      body_override: body_override?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: ctx.user.id,
    })
    .eq('template_key', template_key)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
