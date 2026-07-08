import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { runComplianceGate } from '@/lib/social';
import type { Platform, MediaType } from '@/lib/social/types';

/**
 * Admin-only: enqueue a social post into public.social_posts.
 *
 *   POST /api/admin/social/enqueue
 *   { platform, caption, mediaUrl?, mediaType?, link?, scheduledFor?, source?, dedupeKey? }
 *
 * Runs the compliance gate up front so an admin gets immediate feedback and a
 * non-compliant caption never enters the queue. The /api/cron/social-autopost
 * cron picks up 'pending' rows whose scheduled_for is due. This is also the
 * hook the monthly generator pipeline can call to load a batch.
 */
const PLATFORMS = new Set<Platform>(['x', 'youtube', 'instagram', 'facebook', 'pinterest']);
const MEDIA_TYPES = new Set<MediaType>(['video', 'image', 'none']);

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const platform = String(body.platform ?? '') as Platform;
  const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
  const mediaUrl = typeof body.mediaUrl === 'string' ? body.mediaUrl.trim() : null;
  const mediaType = (typeof body.mediaType === 'string' ? body.mediaType : 'none') as MediaType;
  const link = typeof body.link === 'string' ? body.link.trim() : null;
  const scheduledFor =
    typeof body.scheduledFor === 'string' ? body.scheduledFor : new Date().toISOString();
  const source = typeof body.source === 'string' ? body.source : 'manual';
  const dedupeKey = typeof body.dedupeKey === 'string' ? body.dedupeKey : null;

  if (!PLATFORMS.has(platform)) {
    return NextResponse.json({ error: 'Invalid Platform' }, { status: 400 });
  }
  if (!caption) {
    return NextResponse.json({ error: 'Caption Is Required' }, { status: 400 });
  }
  if (!MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json({ error: 'Invalid Media Type' }, { status: 400 });
  }
  if (mediaType !== 'none' && !mediaUrl) {
    return NextResponse.json({ error: 'Media URL Required For Media Posts' }, { status: 400 });
  }

  // Compliance gate up front — do not queue anything that would be blocked.
  const compliance = runComplianceGate(caption, link ?? undefined);
  if (!compliance.ok) {
    return NextResponse.json(
      { error: 'Blocked By Compliance Gate', blocked: compliance.blocked },
      { status: 422 },
    );
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      platform,
      caption,
      media_url: mediaUrl,
      media_type: mediaType,
      link,
      scheduled_for: scheduledFor,
      source,
      dedupe_key: dedupeKey,
      compliance_checked: true,
      compliance_notes: compliance.notes,
    })
    .select('id, platform, scheduled_for, status')
    .maybeSingle();

  if (error) {
    // unique dedupe_key violation -> treat as idempotent success-ish
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, post: data }, { status: 201 });
}
