import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('compounds')
    .select('id, slug, name, intranasal_bioavailability, intranasal_onset_min, intranasal_peak_min, intranasal_notes')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ compounds: data || [] });
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = await createAdminClient();
  const body = await req.json();
  const { slug, intranasal_bioavailability, intranasal_onset_min, intranasal_peak_min, intranasal_notes } = body;

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const { error } = await supabase
    .from('compounds')
    .update({ intranasal_bioavailability, intranasal_onset_min, intranasal_peak_min, intranasal_notes })
    .eq('slug', slug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
