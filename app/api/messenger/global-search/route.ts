import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({ q: z.string().min(1).max(120) });

interface ParticipantRow { conversation_id: string }

interface ConversationRow {
  id: string;
  type: string;
  title: string | null;
  avatar_url: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
}

interface CounterpartyRow {
  conversation_id: string;
  user_id: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  username: string | null;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data: parts } = await svc
    .from('messenger_participants')
    .select('conversation_id')
    .eq('user_id', user.id);
  const conversationIds = ((parts ?? []) as ParticipantRow[]).map((p) => p.conversation_id);
  if (conversationIds.length === 0) {
    return NextResponse.json({ messages: [], conversations: [] });
  }

  const term = parsed.data.q.replace(/[\\%_]/g, (c) => '\\' + c);

  const [messagesRes, convsRes] = await Promise.all([
    svc
      .from('messenger_messages')
      .select('id, conversation_id, sender_id, text, message_type, created_at')
      .in('conversation_id', conversationIds)
      .eq('is_deleted', false)
      .ilike('text', `%${term}%`)
      .order('created_at', { ascending: false })
      .limit(50),
    svc
      .from('messenger_conversations')
      .select('id, type, title, avatar_url, last_message_text, last_message_at')
      .in('id', conversationIds)
      .ilike('title', `%${term}%`)
      .limit(20),
  ]);

  // Audit fix: direct conversations have null titles. We let the title
  // ilike filter above match by title; we ALSO want to surface direct
  // conversations whose counterparty name matches. Two passes:
  //   1) Fetch ALL of the caller's direct conversations (cheap; capped by
  //      conversationIds list), then look up their counterparty profile.
  //   2) Filter client-side here for any whose counterparty name matches.
  // Then merge with the title-match rows, dedupe, cap at 20.
  const directConvIds: string[] = [];
  const { data: directRows } = await svc
    .from('messenger_conversations')
    .select('id, type, title, avatar_url, last_message_text, last_message_at')
    .in('id', conversationIds)
    .eq('type', 'direct');
  const directConvList = ((directRows ?? []) as ConversationRow[]);
  directConvList.forEach((c) => directConvIds.push(c.id));

  let counterpartyByConv = new Map<string, ProfileRow>();
  if (directConvIds.length > 0) {
    const { data: cps } = await svc
      .from('messenger_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', directConvIds)
      .neq('user_id', user.id);
    const cpRows = ((cps ?? []) as CounterpartyRow[]);
    const otherIds = Array.from(new Set(cpRows.map((r) => r.user_id)));
    let profileMap = new Map<string, ProfileRow>();
    if (otherIds.length > 0) {
      const { data: profs } = await svc
        .from('profiles')
        .select('id, full_name, username')
        .in('id', otherIds);
      profileMap = new Map(((profs ?? []) as ProfileRow[]).map((p) => [p.id, p]));
    }
    counterpartyByConv = new Map(
      cpRows
        .map((r) => {
          const p = profileMap.get(r.user_id);
          return p ? ([r.conversation_id, p] as const) : null;
        })
        .filter((x): x is readonly [string, ProfileRow] => x !== null),
    );
  }

  // Match-by-counterparty: direct conversations where the OTHER user's
  // full_name or username contains the search term, case-insensitive.
  const termLower = parsed.data.q.toLowerCase();
  const counterpartyMatchedDirects = directConvList.filter((c) => {
    const cp = counterpartyByConv.get(c.id);
    if (!cp) return false;
    return (
      (cp.full_name?.toLowerCase().includes(termLower) ?? false) ||
      (cp.username?.toLowerCase().includes(termLower) ?? false)
    );
  });

  // Merge title-match + counterparty-match, dedupe by id, attach counterparty
  // info on every direct row so the UI can render the correct label.
  const seen = new Set<string>();
  const merged: Array<ConversationRow & { counterparty_full_name?: string | null; counterparty_username?: string | null }> = [];
  const pushRow = (c: ConversationRow) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    const cp = counterpartyByConv.get(c.id);
    merged.push({
      ...c,
      counterparty_full_name: cp?.full_name ?? null,
      counterparty_username: cp?.username ?? null,
    });
  };
  ((convsRes.data ?? []) as ConversationRow[]).forEach(pushRow);
  counterpartyMatchedDirects.forEach(pushRow);
  const trimmed = merged.slice(0, 20);

  return NextResponse.json({
    messages: messagesRes.data ?? [],
    conversations: trimmed,
  });
}
