import { NextResponse } from 'next/server';
export async function GET() {
  return new NextResponse("HELLO WORLD", { status: 200 });
}
