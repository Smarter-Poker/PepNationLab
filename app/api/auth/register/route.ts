import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Public registration is permanently disabled on PepNationLab. New researchers
// must be invited by an existing agent via /api/agent/create-researcher.
export async function POST() {
  return NextResponse.json(
    { error: 'Registration is disabled. Contact your agent for an invitation.' },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: 'Registration is disabled. Contact your agent for an invitation.' },
    { status: 410 }
  );
}
