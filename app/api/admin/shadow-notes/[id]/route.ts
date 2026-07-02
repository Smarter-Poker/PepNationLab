import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updates: { body?: string; pinned?: boolean } = {};
  if (body.body !== undefined) {
    const trimmed = String(body.body).trim();
    if (trimmed.length < 1 || trimmed.length > 4000) {
      return NextResponse.json({ error: 'Body Must Be 1 To 4000 Characters' }, { status: 400 });
    }
    updates.body = trimmed;
  }
  if (body.pinned !== undefined) {
    updates.pinned = body.pinned === true;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No Changes' }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { error } = await svc.from('admin_shadow_notes').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed To Update' }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const svc = await createServiceClient();
  const { error } = await svc.from('admin_shadow_notes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed To Delete' }, { status: 500 });
  return NextResponse.json({ success: true });
}
