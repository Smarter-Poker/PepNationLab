import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/wallet/search-recipients?q=<query>
 *
 * Live recipient search for the Send Funds sheet. Returns up to 8 active
 * profiles whose full_name, username, or email match the query - sorted
 * with exact-prefix matches first.
 *
 * Gated to admin / super_agent / agent (the same set requireAgent allows
 * to send funds). Researchers never need this surface.
 *
 * Escapes `%` and `_` in the input so PostgREST `.ilike` matches the literal
 * substring (and not whichever profile happens to sort first behind a user-
 * supplied wildcard).
 */

function escapeLikePattern(value: string): string {
  // Escape PostgreSQL ILIKE special characters: \ % _ and [ (POSIX char-class).
  return value.replace(/\\/g, '\\\\').replace(/[%_[]/g, (m) => '\\' + m);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: me } = await svc
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (!me || me.is_active === false) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const role = (me.role as string) || 'researcher';
  if (!['admin', 'super_agent', 'agent'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();

  // Empty query - return nothing. The sheet shows recent contacts client-side
  // when there's no input; we don't return every user on the platform here.
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  if (q.length > 60) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${escapeLikePattern(q)}%`;

  // OR across the three identity columns. Using PostgREST's or(...) lets us
  // hit all three in a single query.
  const orClause = [
    `full_name.ilike.${pattern}`,
    `username.ilike.${pattern}`,
    `email.ilike.${pattern}`,
  ].join(',');

  const { data, error } = await svc
    .from('profiles')
    .select('id, full_name, username, email, role, is_super_agent, is_sub_agent')
    .eq('is_active', true)
    .neq('id', user.id)
    .or(orClause)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: 'Search Failed' }, { status: 500 });
  }

  // Rank: exact match > prefix match > substring match. Lighter weight on
  // username matches since usernames are the canonical identifier here.
  type Row = { id: string; full_name: string | null; username: string | null; email: string | null; role: string | null; is_super_agent: boolean | null; is_sub_agent: boolean | null };
  function score(r: Row): number {
    const fn = (r.full_name || '').toLowerCase();
    const un = (r.username || '').toLowerCase();
    const em = (r.email || '').toLowerCase();
    if (un === q || em === q || fn === q) return 0;
    if (un.startsWith(q)) return 1;
    if (fn.startsWith(q) || em.startsWith(q)) return 2;
    if (un.includes(q)) return 3;
    return 4;
  }
  const ranked = ((data as Row[]) || [])
    .map((r) => ({ row: r, s: score(r) }))
    .sort((a, b) => a.s - b.s || (a.row.full_name || a.row.username || '').localeCompare(b.row.full_name || b.row.username || ''))
    .slice(0, 8)
    .map(({ row }) => {
      // Friendly role label for the picker chip.
      let roleLabel = 'Researcher';
      if (row.is_super_agent === true) roleLabel = 'Super Agent';
      else if (row.is_sub_agent === true) roleLabel = 'Sub Agent';
      else if (row.role === 'admin') roleLabel = 'Admin';
      else if (row.role === 'agent') roleLabel = 'Agent';
      else if (row.role === 'super_agent') roleLabel = 'Super Agent';
      return {
        id: row.id,
        full_name: row.full_name,
        username: row.username,
        email: row.email,
        role: row.role,
        role_label: roleLabel,
      };
    });

  return NextResponse.json({ results: ranked });
}
