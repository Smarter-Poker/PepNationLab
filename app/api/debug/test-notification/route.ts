import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('notifications').insert({
    user_id: user.id,
    type: 'system',
    title: 'Test Notification',
    body: 'This is a test to see if the red badge appears!',
    url: '/dashboard'
  }).select().single();

  return NextResponse.json({ success: true, notification: data, error });
}
