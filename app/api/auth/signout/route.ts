import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error('[auth/signout] POST error:', err);
    // Still redirect even if the server-side sign-out fails;
    // the client cookie will expire and the session becomes unusable.
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url, 303);
}
