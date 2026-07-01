import { NextResponse } from 'next/server';

// Tombstone: debug endpoint removed from production.
// Debug and smoke-test routes must never ship to production — they bypass
// normal request validation and expose internal behaviour to any auth'd caller.
export async function GET() {
  return NextResponse.json({ error: 'Gone.' }, { status: 410 });
}

