// R24 phase 6 — AI Weekly Summary.
// Compares this week vs last and produces a 2-sentence narrative.
// Uses Anthropic Claude API if ANTHROPIC_API_KEY is set; otherwise returns a
// deterministic rule-based summary so the feature still ships without keys.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  const thisStart = new Date(now);
  thisStart.setUTCDate(thisStart.getUTCDate() - 7);
  const priorStart = new Date(now);
  priorStart.setUTCDate(priorStart.getUTCDate() - 14);

  const [{ data: cur }, { data: prev }] = await Promise.all([
    supabase.rpc('agent_sales_kpis', { p_agent_id: user.id, p_start: thisStart.toISOString(), p_end: now.toISOString() }),
    supabase.rpc('agent_sales_kpis', { p_agent_id: user.id, p_start: priorStart.toISOString(), p_end: thisStart.toISOString() }),
  ]);

  const c = cur?.[0] ?? { revenue_cents: 0, orders_count: 0 };
  const p = prev?.[0] ?? { revenue_cents: 0, orders_count: 0 };

  // Deterministic fallback if no AI key
  const revDelta = Number(p.revenue_cents) === 0 ? null : ((Number(c.revenue_cents) - Number(p.revenue_cents)) / Number(p.revenue_cents)) * 100;
  let summary = '';
  if (revDelta === null) {
    summary = `Last 7 days: ${money(Number(c.revenue_cents))} on ${c.orders_count} orders. No prior-week data to compare.`;
  } else if (revDelta >= 0) {
    summary = `Revenue is up ${Math.abs(revDelta).toFixed(1)}% week-over-week (${money(Number(c.revenue_cents))} vs ${money(Number(p.revenue_cents))}). Orders ${c.orders_count} vs ${p.orders_count}.`;
  } else {
    summary = `Revenue is down ${Math.abs(revDelta).toFixed(1)}% week-over-week (${money(Number(c.revenue_cents))} vs ${money(Number(p.revenue_cents))}). Orders ${c.orders_count} vs ${p.orders_count} — worth investigating which products softened.`;
  }

  // If ANTHROPIC_API_KEY is set, upgrade to a real narrative.
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const ai = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Write a concise 2-sentence weekly sales summary in a friendly tone. Current week revenue ${money(Number(c.revenue_cents))} on ${c.orders_count} orders. Prior week ${money(Number(p.revenue_cents))} on ${p.orders_count} orders. No emojis. Plain text only.`,
          }],
        }),
      });
      if (ai.ok) {
        const j = await ai.json();
        const text = j?.content?.[0]?.text;
        if (typeof text === 'string' && text.trim()) summary = text.trim();
      }
    } catch { /* fall back to deterministic */ }
  }

  return NextResponse.json({
    summary,
    period: { start: thisStart.toISOString(), end: now.toISOString() },
    revenue_cents: Number(c.revenue_cents),
    revenue_cents_prior: Number(p.revenue_cents),
    orders_count: Number(c.orders_count),
    orders_count_prior: Number(p.orders_count),
  });
}
