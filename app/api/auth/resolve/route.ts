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

  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('username', username)
    .eq('is_active', true)
    .single();

  if (error || !data?.email) {
    // Return a generic error — don't reveal whether the username exists
    return NextResponse.json({ error: 'Invalid Username Or Password' }, { status: 404 });
  }

  return NextResponse.json({ email: data.email });
}
