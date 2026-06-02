import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Tombstone: the standalone support_requests intake was superseded by the
// shared messenger support channel (POST /api/messenger/support/open), which
// the admin Customer Support inbox monitors. The Help page now opens a live
// support thread there instead of writing to a parallel, unmonitored table.
// Kept as 410 Gone so any straggler caller sees a clear, intentional status.
export async function GET() {
  return NextResponse.json(
    { error: 'Gone. Use /api/messenger/support/open.' },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Gone. Use /api/messenger/support/open.' },
    { status: 410 },
  );
}
