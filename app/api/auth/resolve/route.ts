import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/auth/resolve
// Takes a username, returns the auth email for that user.
// Called by the login form before signInWithPassword.
// Uses service role so it can query profiles regardless of RLS.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = (body.username ?? '').trim().toLowerCase();

  if (!username) {
    return NextResponse.json({ error: 'Username Required' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Fallback: If it's an email format, allow them to log in directly via email
  if (username.includes('@')) {
    return NextResponse.json({ email: username });
  }

  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('username', username)
    .eq('is_active', true)
    .maybeSingle();

  if (!data?.email) {
    // Do NOT reveal whether the username exists. Return a synthetic email so
    // the downstream password check fails uniformly with the same shape as a
    // wrong-password attempt on a real account.
    const safeUsername = username.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    return NextResponse.json({ email: `${safeUsername}@nodom.invalid` });
  }

  return NextResponse.json({ email: data.email });
}
