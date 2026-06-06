import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();
  
  try {
    const { id, email, phone } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    // Block modifying another admin's contact info - prevents account takeover via email change.
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .maybeSingle();

    if (targetProfile?.role === 'admin') {
      return NextResponse.json({ error: 'Cannot Modify Another Admin\'s Contact Info Via This Route' }, { status: 403 });
    }

    // Validate email format before pushing it to auth.users + profiles -
    // an invalid value would otherwise fail mid-update and leak a provider error.
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return NextResponse.json({ error: 'Please Enter A Valid Email Address' }, { status: 400 });
      }
    }

    const updates: { email?: string; phone?: string | null } = {};
    if (email) updates.email = String(email).trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone || null;

    // 1. Update auth.users if email is provided
    if (updates.email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, {
        email: updates.email,
        email_confirm: true,
      });
      
      if (authError) {
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
      }
    }

    // 2. Update profiles table
    if (Object.keys(updates).length > 0) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id);

      if (profileError) {
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
