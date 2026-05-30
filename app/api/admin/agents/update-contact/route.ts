import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  
  try {
    const { id, email, phone } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    // Block modifying another admin's contact info — prevents account takeover via email change.
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .maybeSingle();

    if (targetProfile?.role === 'admin') {
      return NextResponse.json({ error: 'Cannot Modify Another Admin\'s Contact Info Via This Route' }, { status: 403 });
    }

    const updates: { email?: string; phone?: string | null } = {};
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone || null;

    // 1. Update auth.users if email is provided
    if (updates.email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, {
        email: updates.email,
        email_confirm: true,
      });
      
      if (authError) {
        return NextResponse.json({ error: `Auth Error: ${authError.message}` }, { status: 500 });
      }
    }

    // 2. Update profiles table
    if (Object.keys(updates).length > 0) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id);

      if (profileError) {
        return NextResponse.json({ error: `Profile Error: ${profileError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
