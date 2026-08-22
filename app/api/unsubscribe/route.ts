/**
 * GET/POST /api/unsubscribe?uid=<profile id>&token=<hmac>
 *
 * Public one-click marketing-email opt-out (CAN-SPAM + RFC 8058). The link and
 * List-Unsubscribe headers on every marketing send (abandoned-cart recovery,
 * product alerts) point here. Token is a deterministic per-user HMAC minted by
 * unsubscribeToken() in lib/email.ts, compared in constant time -- no session
 * required, nothing stored, no enumeration surface beyond a boolean flip.
 *
 * POST exists for RFC 8058 one-click unsubscribe (mail clients POST with no
 * body); GET serves the human clicking the footer link. Both are idempotent.
 * Transactional email (orders, codes, security alerts) is NOT affected by
 * this flag.
 */

export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { unsubscribeToken } from '@/lib/email';

function page(title: string, message: string): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title} - Pep Nation Lab</title>
</head>
<body style="margin:0;padding:0;background:#050A0F;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:64px 24px;color:#D0DAE4;">
    <div style="font-size:18px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#00C4BC;margin-bottom:24px;">Pep Nation Lab</div>
    <h1 style="font-size:22px;color:#FFFFFF;margin:0 0 12px;">${title}</h1>
    <p style="font-size:15px;line-height:1.7;margin:0;">${message}</p>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function tokenMatches(uid: string, token: string): boolean {
  const expected = unsubscribeToken(uid);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const uid = (req.nextUrl.searchParams.get('uid') || '').trim();
  const token = (req.nextUrl.searchParams.get('token') || '').trim();

  if (!uid || !token || !tokenMatches(uid, token)) {
    return page('Link Invalid', 'This Unsubscribe Link Is Invalid Or Has Expired. If You Continue To Receive Unwanted Email, Contact Your Agent.');
  }

  try {
    const admin = createAdminClient();
    await admin.from('profiles').update({ email_opt_out: true }).eq('id', uid);
  } catch {
    // Even on a transient DB failure, do not leak internals; the sender crons
    // re-check the flag every run, so a retry of this link self-heals.
    return page('Something Went Wrong', 'We Could Not Process Your Request Right Now. Please Try The Link Again In A Few Minutes.');
  }

  return page(
    'You Are Unsubscribed',
    'You Will No Longer Receive Marketing Emails From Pep Nation Lab. Transactional Emails About Your Orders And Account Security Will Still Be Delivered.',
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
