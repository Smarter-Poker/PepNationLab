export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { emailConfigured, sendAdminBlastEmail } from '@/lib/email';
import { getHouseAgentId } from '@/lib/coupons';

/**
 * Admin Email Center (owner request 2026-07-14).
 *
 * GET  -> { configured, audiences: [{key,label,count}], history: [...] }
 * POST -> { mode: 'test' | 'send', audience, subject, body, includePromo }
 *         test: sends ONLY to the admin's own email.
 *         send: sends to every resolvable recipient in the audience.
 *
 * Recipient rules (same as the lifecycle cron): verified contact_email when
 * present, else the account's login email; @internal.auth aliases are never
 * mailable; email_opt_out is always honored. Every delivery lands in
 * email_log (template 'admin_blast') and each blast is recorded in
 * email_blasts for the history panel.
 */

const AUDIENCES: Array<{ key: string; label: string }> = [
  { key: 'researchers_house', label: 'My Direct Customers (House Store)' },
  { key: 'researchers_all', label: 'All Researchers' },
  { key: 'researchers_never_ordered', label: 'Researchers Who Never Ordered' },
  { key: 'agents_all', label: 'All Agents & Super Agents' },
];

const MAX_RECIPIENTS = 2000;

interface Recipient {
  id: string;
  email: string;
  fullName: string | null;
  firstName: string;
}

function resolveEmail(row: {
  email: string | null;
  contact_email: string | null;
  email_verified: boolean | null;
  email_opt_out: boolean | null;
}): string | null {
  if (row.email_opt_out) return null;
  const candidate = (row.email_verified && row.contact_email ? row.contact_email : row.email) || row.contact_email;
  if (!candidate) return null;
  const email = String(candidate).trim().toLowerCase();
  if (!email.includes('@') || email.endsWith('@internal.auth')) return null;
  return email;
}

async function resolveAudience(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  audience: string,
): Promise<Recipient[]> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, first_name, username, email, contact_email, email_verified, email_opt_out, referring_agent_id, role')
    // Treat a NULL is_active as active: `.neq(false)` would silently drop
    // NULL rows (SQL three-valued logic), excluding legacy profiles.
    .or('is_active.is.null,is_active.eq.true')
    .limit(5000);

  if (audience === 'agents_all') {
    query = query.in('role', ['agent', 'super_agent']);
  } else {
    query = query.eq('role', 'researcher');
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(`audience fetch failed: ${error.message}`);
  let list = rows ?? [];

  if (audience === 'researchers_house') {
    const houseId = await getHouseAgentId(supabase);
    list = list.filter((r) => houseId && r.referring_agent_id === houseId);
  }

  if (audience === 'researchers_never_ordered') {
    const ids = list.map((r) => r.id);
    const { data: orderRows } = ids.length
      ? await supabase.from('orders').select('buyer_id').in('buyer_id', ids).neq('status', 'cancelled').limit(10000)
      : { data: [] as Array<{ buyer_id: string }> };
    const bought = new Set((orderRows ?? []).map((o) => o.buyer_id as string));
    list = list.filter((r) => !bought.has(r.id));
  }

  const out: Recipient[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    const email = resolveEmail(r);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      id: r.id,
      email,
      fullName: r.full_name ?? null,
      firstName: (r.first_name || (r.full_name || '').split(' ')[0] || r.username || 'Researcher') as string,
    });
    if (out.length >= MAX_RECIPIENTS) break;
  }
  return out;
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const supabase = await createServiceClient();

  const audiences: Array<{ key: string; label: string; count: number }> = [];
  for (const a of AUDIENCES) {
    try {
      const recipients = await resolveAudience(supabase, a.key);
      audiences.push({ ...a, count: recipients.length });
    } catch {
      audiences.push({ ...a, count: -1 });
    }
  }

  const { data: history } = await supabase
    .from('email_blasts')
    .select('id, subject, audience, include_promo, sent_count, skipped_count, created_at')
    .order('created_at', { ascending: false })
    .limit(25);

  return NextResponse.json({ configured: emailConfigured(), audiences, history: history ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  if (!emailConfigured()) {
    return NextResponse.json({ error: 'Email Sending Is Not Configured On The Server.' }, { status: 503 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }

  const mode = body?.mode === 'test' ? 'test' : 'send';
  const audience = String(body?.audience ?? '');
  const subject = String(body?.subject ?? '').trim().slice(0, 200);
  const message = String(body?.body ?? '').trim().slice(0, 8000);
  const includePromo = body?.includePromo === true;

  if (!subject) return NextResponse.json({ error: 'A Subject Is Required.' }, { status: 400 });
  if (!message) return NextResponse.json({ error: 'A Message Body Is Required.' }, { status: 400 });
  if (!AUDIENCES.some((a) => a.key === audience)) {
    return NextResponse.json({ error: 'Choose A Valid Audience.' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const promoCode = includePromo ? 'FIRST20' : null;

  if (mode === 'test') {
    const { data: me } = await supabase
      .from('profiles')
      .select('email, contact_email, email_verified, full_name, first_name, username')
      .eq('id', gate.userId)
      .maybeSingle();
    const to = resolveEmail({
      email: me?.email ?? null,
      contact_email: me?.contact_email ?? null,
      email_verified: me?.email_verified ?? null,
      email_opt_out: false,
    });
    if (!to) return NextResponse.json({ error: 'Your Admin Account Has No Mailable Email Address On File.' }, { status: 400 });
    const firstName = (me?.first_name || (me?.full_name || '').split(' ')[0] || 'Researcher') as string;
    const result = await sendAdminBlastEmail({
      to,
      userId: gate.userId,
      fullName: me?.full_name,
      subject,
      body: message.replace(/\{name\}/g, firstName),
      promoCode,
    });
    if (!result.ok) return NextResponse.json({ error: `Test Send Failed (${result.error || 'unknown'}).` }, { status: 502 });
    return NextResponse.json({ success: true, test: true, to });
  }

  let recipients: Recipient[];
  try {
    recipients = await resolveAudience(supabase, audience);
  } catch (e) {
    return NextResponse.json({ error: 'Could Not Resolve The Audience.' }, { status: 500 });
  }
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'That Audience Has No Mailable Recipients.' }, { status: 400 });
  }

  // Record the blast first so a mid-send crash is still visible in history.
  const { data: blast } = await supabase
    .from('email_blasts')
    .insert({ subject, body: message, audience, include_promo: includePromo, created_by: gate.userId })
    .select('id')
    .maybeSingle();

  let sent = 0;
  let skipped = 0;
  for (const r of recipients) {
    const result = await sendAdminBlastEmail({
      to: r.email,
      userId: r.id,
      fullName: r.fullName,
      subject,
      body: message.replace(/\{name\}/g, r.firstName),
      promoCode,
    });
    if (result.ok && !result.skipped) sent++; else skipped++;
  }

  if (blast?.id) {
    await supabase.from('email_blasts').update({ sent_count: sent, skipped_count: skipped }).eq('id', blast.id);
  }

  return NextResponse.json({ success: true, sent, skipped, recipients: recipients.length });
}
