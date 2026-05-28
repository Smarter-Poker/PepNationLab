import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;

  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url, 303);
}
