import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getCachedUser } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';

async function requireAdmin() {
  const { user } = await getCachedUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (data?.role !== 'admin') return null;
  return { user, admin };
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { subject, body: msgBody, segment = 'all' } = body ?? {};
  if (!subject?.trim() || !msgBody?.trim())
    return NextResponse.json({ error: 'subject and body required' }, { status: 400 });

  // Fetch researcher emails
  let query = ctx.admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'researcher')
    .not('email', 'is', null)
    .limit(500);

  if (segment === 'with_orders') {
    // researchers who have at least one order
    const { data: orderedIds } = await ctx.admin
      .from('orders')
      .select('buyer_id')
      .limit(1000);
    const ids = [...new Set((orderedIds ?? []).map((r: { buyer_id: string }) => r.buyer_id))];
    if (ids.length === 0) return NextResponse.json({ sent: 0 });
    query = query.in('id', ids);
  }

  const { data: researchers, error: fetchErr } = await query;
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  let sent = 0;
  let failed = 0;

  for (const r of (researchers ?? [])) {
    if (!r.email) continue;
    const html = msgBody
      .split('\n')
      .map((line: string) =>
        line.trim()
          ? `<p style="font-size:14px;line-height:1.7;margin:0 0 12px;">${line
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</p>`
          : ''
      )
      .join('');
    const result = await sendEmail({
      to: r.email,
      subject: subject.trim(),
      html: `<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#060C14;font-family:Inter,Arial,sans-serif;color:#C8D6E0;margin:0;padding:24px;">${html}<p style="font-size:11px;color:#506070;margin:24px 0 0;">Pep Nation Lab — For Research Purposes Only</p></body></html>`,
      text: msgBody,
      template: 'blast',
    });
    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ sent, failed, total: (researchers ?? []).length });
}
