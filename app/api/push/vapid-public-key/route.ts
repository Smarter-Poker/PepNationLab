import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Public endpoint that hands the VAPID application server public key
 * to the browser so it can call PushManager.subscribe({ applicationServerKey }).
 * When the key is not yet configured we return an empty string — the client
 * shows a "Push Notifications Not Available Yet" message in that case.
 */
export async function GET() {
  const key =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    '';
  return NextResponse.json({ key });
}
