import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron';
import { createServiceClient } from '@/lib/supabase/server';
import { runComplianceGate } from '@/lib/social';
import type { Platform, MediaType } from '@/lib/social/types';
import { safeError } from '@/lib/api-error';

/**
 * Batch enqueue for the social publishing queue - the generator's way in.
 *
 *   POST /api/social/ingest
 *   Authorization: Bearer <CRON_SECRET>
 *   { "posts": [ { platform, caption, mediaUrl?, mediaType?, link?,
 *                  scheduledFor?, source?, dedupeKey? }, ... ] }
 *
 * Auth is the shared CRON_SECRET rather than an admin session, so the GitHub
 * Actions generator can fill the queue WITHOUT ever holding the service-role
 * key. No CSRF check: there are no ambient browser credentials to forge here,
 * the bearer secret is the whole control (same posture as the cron routes).
 *
 * Behaviour worth knowing:
 *  - Every caption runs the compliance gate up front. A caption that trips it is
 *    still INSERTED, as status 'blocked' with the offending terms recorded, so it
 *    surfaces in the admin console instead of vanishing. Blocked rows are never
 *    picked up by the cron, so nothing can publish.
 *  - dedupeKey makes re-runs idempotent (unique partial index on the column).
 *    Re-running the monthly generator will not double-queue a month of posts.
 */
export const dynamic = 'force-dynamic';

const PLATFORMS = new Set<Platform>(['x', 'youtube', 'instagram', 'facebook', 'pinterest', 'tiktok']);
const MEDIA_TYPES = new Set<MediaType>(['video', 'image', 'none']);
const MAX_BATCH = 100;

interface IncomingPost {
  platform?: unknown;
  caption?: unknown;
  mediaUrl?: unknown;
  mediaType?: unknown;
  link?: unknown;
  scheduledFor?: unknown;
  source?: unknown;
  dedupeKey?: unknown;
}

interface PreparedRow {
  platform: Platform;
  caption: string;
  media_url: string | null;
  media_type: MediaType;
  link: string | null;
  scheduled_for: string;
  source: string;
  dedupe_key: string | null;
  status: 'pending' | 'blocked';
  compliance_checked: boolean;
  compliance_notes: string | null;
}

function prepare(p: IncomingPost, index: number): PreparedRow | { error: string } {
  const platform = String(p.platform ?? '') as Platform;
  if (!PLATFORMS.has(platform)) return { error: `posts[${index}]: invalid platform` };

  const caption = typeof p.caption === 'string' ? p.caption.trim() : '';
  if (!caption) return { error: `posts[${index}]: caption is required` };

  const mediaType = (typeof p.mediaType === 'string' ? p.mediaType : 'none') as MediaType;
  if (!MEDIA_TYPES.has(mediaType)) return { error: `posts[${index}]: invalid mediaType` };

  const mediaUrl = typeof p.mediaUrl === 'string' && p.mediaUrl.trim() ? p.mediaUrl.trim() : null;
  if (mediaType !== 'none' && !mediaUrl) {
    return { error: `posts[${index}]: mediaUrl required when mediaType is ${mediaType}` };
  }

  const link = typeof p.link === 'string' && p.link.trim() ? p.link.trim() : null;

  let scheduledFor = new Date().toISOString();
  if (typeof p.scheduledFor === 'string') {
    const d = new Date(p.scheduledFor);
    if (Number.isNaN(d.getTime())) return { error: `posts[${index}]: invalid scheduledFor` };
    scheduledFor = d.toISOString();
  }

  const gate = runComplianceGate(caption, link ?? undefined);

  return {
    platform,
    caption,
    media_url: mediaUrl,
    media_type: mediaType,
    link,
    scheduled_for: scheduledFor,
    source: typeof p.source === 'string' ? p.source : 'generator',
    dedupe_key: typeof p.dedupeKey === 'string' && p.dedupeKey ? p.dedupeKey : null,
    status: gate.ok ? 'pending' : 'blocked',
    compliance_checked: true,
    compliance_notes: gate.ok ? gate.notes : `blocked: ${gate.blocked.join(', ')}`,
  };
}

export async function POST(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const body = (await req.json().catch(() => ({}))) as { posts?: unknown };
  const posts = Array.isArray(body.posts) ? (body.posts as IncomingPost[]) : null;

  if (!posts || posts.length === 0) {
    return NextResponse.json({ error: 'Body Must Contain A Non-Empty posts Array' }, { status: 400 });
  }
  if (posts.length > MAX_BATCH) {
    return NextResponse.json({ error: `At Most ${MAX_BATCH} Posts Per Request` }, { status: 400 });
  }

  const rows: PreparedRow[] = [];
  for (let i = 0; i < posts.length; i += 1) {
    const prepared = prepare(posts[i], i);
    if ('error' in prepared) {
      return NextResponse.json({ error: prepared.error }, { status: 400 });
    }
    rows.push(prepared);
  }

  const supabase = await createServiceClient();

  // Idempotent: a repeated dedupe_key is ignored rather than duplicated.
  const { data, error } = await supabase
    .from('social_posts')
    .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id, platform, status, dedupe_key');

  if (error) {
    return safeError('social.ingest.upsert', error, 500, 'Failed To Ingest Posts.');
  }

  const inserted = data ?? [];
  const blocked = inserted.filter((r) => (r as { status: string }).status === 'blocked').length;

  return NextResponse.json(
    {
      ok: true,
      received: rows.length,
      inserted: inserted.length,
      duplicates: rows.length - inserted.length,
      queued: inserted.length - blocked,
      blocked,
    },
    { status: 201 },
  );
}
