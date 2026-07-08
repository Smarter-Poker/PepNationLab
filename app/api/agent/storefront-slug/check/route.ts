import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { generateSlugSuggestions, containsProfanity } from '@/lib/availability-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/storefront-slug/check?slug=<candidate>
 *
 * Live availability check for the onboarding storefront step. Debounced on the
 * client. Returns whether the slug is usable by the caller and, when it is not,
 * up to 3 available alternative suggestions. Read-only; the authoritative
 * reservation/uniqueness still happens in POST /api/agent/storefront-slug.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const raw = req.nextUrl.searchParams.get('slug') ?? '';
  const clean = raw.trim().toLowerCase();

  // Format gate -- mirror the POST route's contract.
  if (!/^[a-z0-9-]{3,30}$/.test(clean)) {
    return NextResponse.json({
      available: false,
      reason: 'Web Address Must Be 3-30 Characters: Lowercase Letters, Numbers, And Hyphens Only.',
      suggestions: [],
    });
  }

  if (containsProfanity(clean)) {
    return NextResponse.json({
      available: false,
      reason: 'That Web Address Is Not Allowed.',
      suggestions: generateSlugSuggestions(clean).slice(0, 3),
    });
  }

  const admin = createAdminClient();

  // Reserved platform words (best-effort -- table may not exist in all envs).
  let reserved = false;
  try {
    const { data: r } = await admin.from('reserved_slugs').select('slug').eq('slug', clean).maybeSingle();
    reserved = !!r;
  } catch {
    /* reserved_slugs not present -- DB CHECK denylist still guards the write */
  }

  // Taken by another agent (exclude the caller's own current slug).
  const { data: owner } = await admin
    .from('agent_profiles')
    .select('id')
    .eq('slug', clean)
    .maybeSingle();
  const takenByOther = !!owner && (owner as { id?: string }).id !== gate.user.id;

  if (!reserved && !takenByOther) {
    return NextResponse.json({ available: true, slug: clean, suggestions: [] });
  }

  // Build up to 3 alternative suggestions that are themselves free.
  const candidates = generateSlugSuggestions(clean).filter((s) => /^[a-z0-9-]{3,30}$/.test(s));
  let suggestions: string[] = [];
  if (candidates.length > 0) {
    const { data: takenRows } = await admin
      .from('agent_profiles')
      .select('slug')
      .in('slug', candidates);
    const takenSet = new Set((takenRows ?? []).map((t) => (t as { slug: string }).slug));
    suggestions = candidates.filter((s) => !takenSet.has(s) && !containsProfanity(s)).slice(0, 3);
  }

  return NextResponse.json({
    available: false,
    reason: reserved ? 'That Web Address Is Reserved.' : 'That Web Address Is Already Taken.',
    suggestions,
  });
}
