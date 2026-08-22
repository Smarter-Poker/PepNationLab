import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    time: new Date().toISOString(),
    status: 'ok'
  });
}
