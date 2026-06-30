import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { revalidatePath, revalidateTag } from 'next/cache';

const VALID = new Set(['established', 'emerging', 'not_suitable']);

// Admin-only: set a compound's intranasal route classification. Mirrors the
// pricing-tiers route pattern (CSRF same-origin check, requireAdmin gate,
// service-role client). Keeps route_of_admin in sync and revalidates the
// cached public compound pages so the nasal badges update immediately.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : '';

  if (!slug) return NextResponse.json({ error: 'Missing Compound Slug' }, { status: 400 });
  if (!VALID.has(status)) return NextResponse.json({ error: 'Invalid Status' }, { status: 400 });

  // Load the current row so route_of_admin stays consistent with the tier.
  const { data: current, error: loadErr } = await supabase
    .from('compounds')
    .select('route_of_admin')
    .eq('slug', slug)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Compound Not Found' }, { status: 404 });

  const routes = new Set<string>(Array.isArray(current.route_of_admin) ? current.route_of_admin : []);
  if (status === 'established' || status === 'emerging') routes.add('intranasal');
  else routes.delete('intranasal');

  const updates: Record<string, unknown> = {
    intranasal_status: status,
    route_of_admin: Array.from(routes),
  };

  // Optional note; empty string clears it.
  if (body.note !== undefined) {
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    updates.intranasal_note = note.length > 0 ? note : null;
  }

  // Optional bioavailability percent (0-100); null/'' clears it.
  if (body.bioavailability_pct !== undefined) {
    if (body.bioavailability_pct === null || body.bioavailability_pct === '') {
      updates.intranasal_bioavailability_pct = null;
    } else {
      const n = Number(body.bioavailability_pct);
      if (isNaN(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: 'Bioavailability Must Be Between 0 And 100' }, { status: 400 });
      }
      updates.intranasal_bioavailability_pct = n;
    }
  }

  const { data: updated, error } = await supabase
    .from('compounds')
    .update(updates)
    .eq('slug', slug)
    .select('slug');

  if (error) return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  if (!updated || updated.length === 0) return NextResponse.json({ error: 'Compound Not Found' }, { status: 404 });

  // Immediately expire the shared 'compounds' cache tag so every public surface
  // (storefront grid, monograph, compare tools, the intranasal collection page)
  // reflects the new classification on the next request instead of waiting for
  // the 60s unstable_cache window. In Next 16 revalidateTag requires a profile
  // arg; { expire: 0 } is the documented immediate-expiration form for route
  // handlers. Also refresh the monograph render paths.
  try {
    revalidateTag('compounds', { expire: 0 });
    revalidatePath(`/research/${slug}`);
    revalidatePath(`/research/compounds/${slug}`);
  } catch { /* best-effort cache refresh */ }

  return NextResponse.json({ success: true });
}
