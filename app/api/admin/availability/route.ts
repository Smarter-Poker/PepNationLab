import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sinceTenMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const [recentRes, ipBurstRes, totalsRes] = await Promise.all([
    supabase
      .from('availability_failed_attempts')
      .select('id, occurred_at, field, value, normalized, reason, reason_code, ip')
      .order('occurred_at', { ascending: false })
      .limit(200),

    supabase
      .from('availability_failed_attempts')
      .select('ip, occurred_at, reason_code')
      .gte('occurred_at', sinceHour)
      .not('ip', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(2000),

    supabase
      .from('availability_failed_attempts')
      .select('reason_code')
      .gte('occurred_at', sinceDay),
  ]);

  // Per-IP burst summary in the last hour.
  const perIp = new Map<string, { count: number; reasons: Set<string>; firstAt: string; lastAt: string }>();
  for (const row of ipBurstRes.data ?? []) {
    const ip = String((row as any).ip || '');
    if (!ip) continue;
    const entry = perIp.get(ip) ?? { count: 0, reasons: new Set<string>(), firstAt: (row as any).occurred_at, lastAt: (row as any).occurred_at };
    entry.count += 1;
    entry.reasons.add(String((row as any).reason_code));
    if ((row as any).occurred_at < entry.firstAt) entry.firstAt = (row as any).occurred_at;
    if ((row as any).occurred_at > entry.lastAt) entry.lastAt = (row as any).occurred_at;
    perIp.set(ip, entry);
  }
  const spikes = Array.from(perIp.entries())
    .filter(([, v]) => v.count >= 10)
    .map(([ip, v]) => ({
      ip,
      count: v.count,
      reasons: Array.from(v.reasons),
      first_at: v.firstAt,
      last_at: v.lastAt,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  // Active bursts in the last 10 minutes — used by the alert tile.
  const tenMinPerIp = new Map<string, number>();
  for (const row of ipBurstRes.data ?? []) {
    if ((row as any).occurred_at < sinceTenMin) continue;
    const ip = String((row as any).ip || '');
    if (!ip) continue;
    tenMinPerIp.set(ip, (tenMinPerIp.get(ip) ?? 0) + 1);
  }
  const bursts = Array.from(tenMinPerIp.entries())
    .filter(([, c]) => c >= 50)
    .map(([ip, count]) => ({ ip, count }));

  // Totals by reason_code over the last 24h.
  const totalsByReason: Record<string, number> = {};
  for (const row of totalsRes.data ?? []) {
    const k = String((row as any).reason_code);
    totalsByReason[k] = (totalsByReason[k] ?? 0) + 1;
  }

  return NextResponse.json({
    recent: recentRes.data ?? [],
    spikes,
    bursts,
    totals_by_reason_24h: totalsByReason,
  });
}
