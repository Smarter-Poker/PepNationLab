import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * POST /api/agent/storefront-slug
 *
 * Update the calling agent's storefront slug with server-side validation
 * and a clean 409 surface when the slug collides with another agent OR
 * the database CHECK denylist (reserved words like admin/api/login/etc).
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.slug === 'string' ? body.slug : '';
  const cleanSlug = raw.trim().toLowerCase();

  // Sanitize: lower-kebab only ([a-z0-9-]).
  if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
    return NextResponse.json(
      { error: 'Slug Must Contain Only Lowercase Letters, Numbers, And Hyphens.' },
      { status: 400 }
    );
  }

  if (cleanSlug.length < 3 || cleanSlug.length > 30) {
    return NextResponse.json(
      { error: 'Slug Must Be Between 3 And 30 Characters.' },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();
  const agentId = gate.user.id;

  const { data, error } = await supabase
    .from('agent_profiles')
    .update({ slug: cleanSlug })
    .eq('id', agentId)
    .select('slug')
    .single();

  if (error) {
    // Postgres unique violation = 23505; CHECK violation = 23514.
    const code = (error as any).code;
    if (code === '23505' || code === '23514') {
      return NextResponse.json(
        { error: 'Slug Is Reserved Or Already In Use' },
        { status: 409 }
      );
    }
    // Some Postgrest wrappers expose the constraint name in the message.
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('reserved') || msg.includes('unique') || msg.includes('duplicate') || msg.includes('check constraint')) {
      return NextResponse.json(
        { error: 'Slug Is Reserved Or Already In Use' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slug: data.slug, url: `/${data.slug}` });
}
