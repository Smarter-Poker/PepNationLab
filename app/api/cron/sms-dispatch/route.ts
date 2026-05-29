import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// SMS dispatch has been removed. PepNationLab no longer uses Twilio.
export async function GET() { return NextResponse.json({ error: 'SMS Dispatch Removed' }, { status: 410 }); }
