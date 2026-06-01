import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron';

/**
 * fix-55 #4: DEPRECATED — agent-from-sender cart reminder cron.
 *
 * Cart-recovery is now an admin-/platform-owned workflow. Per user
 * direction, agents / super-agents / sub-agents no longer DM
 * researchers about abandoned carts; only /api/cron/abandoned-cart-recovery
 * (admin-branded) sends those messages.
 *
 * This route stays mounted because vercel.json still has its schedule,
 * but it returns a no-op success so we don't hold up the cron slot
 * with a 404 / 500. A future commit will swap this for the 3-step A/B
 * sequence engine.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  return NextResponse.json({
    skipped: true,
    reason: 'deprecated_agent_sender_path',
    canonical: '/api/cron/abandoned-cart-recovery',
  });
}
