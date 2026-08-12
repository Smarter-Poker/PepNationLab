import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * fix-55 #3: admin-only Shadow CRM notes attached to any profile.
 * Subjects can never see notes about themselves - admin_shadow_notes
 * RLS enforces is_admin() for every operation.
 */

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subjectId = req.nextUrl.searchParams.get('subjectId');
  if (!subjectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectId)) {
    return NextResponse.json({ error: 'Valid subjectId Required' }, { status: 400 });
  }

  const ip = getClientIp(req);
  const limited = await rateLimit({ key: 'admin_shadow_notes_get', limit: 120, windowSeconds: 60, identifier: admin.userId || ip });
  if (!limited.allowed) return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });

  const svc = await createServiceClient();
  const { data: notes, error } = await svc
    .from('admin_shadow_notes')
    .select('id, subject_id, author_id, body, pinned, created_at, updated_at')
    .eq('subject_id', subjectId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: 'Failed To Load Notes' }, { status: 500 });

  // Join author names so the UI can label entries.
  const authorIds = Array.from(new Set((notes ?? []).map((n) => n.author_id)));
  let authorMap = new Map<string, { name: string | null; email: string | null }>();
  if (authorIds.length > 0) {
    const { data: authors } = await svc
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds);
    authorMap = new Map(
      (authors ?? []).map((a: any) => [a.id as string, { name: a.full_name as string | null, email: a.email as string | null }])
    );
  }

  const out = (notes ?? []).map((n) => ({
    id: n.id,
    subjectId: n.subject_id,
    authorId: n.author_id,
    authorName: authorMap.get(n.author_id)?.name ?? null,
    authorEmail: authorMap.get(n.author_id)?.email ?? null,
    body: n.body,
    pinned: n.pinned,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));

  const res = NextResponse.json({ notes: out });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = getClientIp(req);
  const limited = await rateLimit({ key: 'admin_shadow_notes_post', limit: 60, windowSeconds: 60, identifier: admin.userId || ip });
  if (!limited.allowed) return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const subjectId = String(body.subjectId ?? '').trim();
  const noteBody = String(body.body ?? '').trim();
  const pinned = body.pinned === true;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectId)) {
    return NextResponse.json({ error: 'Valid subjectId Required' }, { status: 400 });
  }
  if (noteBody.length < 1 || noteBody.length > 4000) {
    return NextResponse.json({ error: 'Body Must Be 1 To 4000 Characters' }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from('admin_shadow_notes')
    .insert({ subject_id: subjectId, author_id: admin.userId!, body: noteBody, pinned })
    .select('id, subject_id, author_id, body, pinned, created_at, updated_at')
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Failed To Save Note' }, { status: 500 });

  return NextResponse.json({
    note: {
      id: data.id,
      subjectId: data.subject_id,
      authorId: data.author_id,
      body: data.body,
      pinned: data.pinned,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  });
}
