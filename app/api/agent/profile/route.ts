import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const ProfilePatchSchema = z
  .object({
    first_name: z.string().trim().min(1).max(60).optional(),
    last_name:  z.string().trim().min(1).max(60).optional(),
    email:      z.union([z.string().trim().email().max(120), z.literal('')]).nullable().optional(),
    phone:      z.string().trim().max(40).nullable().optional(),
    timezone:   z.string().trim().min(1).max(60).optional(),
    avatar_url: z.string().trim().url().max(1024).nullable().optional().or(z.literal('default')),
  })
  .strict();

const PROFILE_COLUMNS =
  'id, full_name, first_name, last_name, email, contact_email, email_verified, phone, timezone, ' +
  'avatar_url, username, username_changed_at, phone_verified_at';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'profile_fetch_failed' }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ProfilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  const changedKeys: string[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v === 'undefined') continue;
    let val = v;
    if (k === 'email' && val === '') val = null;
    updates[k] = val;
    changedKeys.push(k);
  }
  
  if (updates.first_name !== undefined || updates.last_name !== undefined) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();
      
    const currentFirst = currentProfile?.first_name || '';
    const currentLast = currentProfile?.last_name || '';
    
    const newFirst = updates.first_name !== undefined ? (updates.first_name || '') : currentFirst;
    const newLast = updates.last_name !== undefined ? (updates.last_name || '') : currentLast;
    
    updates.full_name = `${String(newFirst).trim()} ${String(newLast).trim()}`.trim();
  }

  if (changedKeys.length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) {
    // Log full details server-side for debugging — never expose raw DB errors to users.
    console.error('[PATCH /api/agent/profile] DB error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      userId: user.id,
      changedKeys,
    });

    // Map known error codes / messages to friendly, actionable UI copy.
    const msg = error.message ?? '';
    let userMessage = 'Could not save your profile. Please try again.';

    if (msg.includes('already exists for this email') || error.code === '23505') {
      userMessage = 'That email address is already linked to another account. Please use a different email.';
    } else if (msg.includes('does not point to a valid agent profile')) {
      // Should never appear after the SECURITY DEFINER fix, but guard anyway.
      userMessage = 'Your account setup is incomplete. Please contact support.';
    } else if (msg.includes('must have referring_agent_id')) {
      userMessage = 'Your account is missing an agent assignment. Please contact your agent.';
    } else if (error.code === '23514') {
      // CHECK constraint violation (e.g. invalid phone format, enum value)
      userMessage = 'One of the values you entered is not valid. Please check your information and try again.';
    } else if (error.code === '42501') {
      userMessage = 'You do not have permission to update this profile.';
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }

  await supabase
    .rpc('log_account_event', {
      p_user_id: user.id,
      p_event: 'profile_updated',
      p_details: { changed: changedKeys },
    })
    .then(() => null, () => null);

  return NextResponse.json({ profile: data });
}
