'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveMatchAction(matchInput: unknown, results: unknown[]) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be logged in to save matches.' };
  }

  const { error } = await supabase
    .from('user_saved_matches')
    .insert({
      user_id: user.id,
      match_input: matchInput,
      results: results,
    });

  if (error) {
    console.error('[SaveMatchAction] error:', error);
    return { error: 'Failed to save match. Please try again.' };
  }

  revalidatePath('/dashboard');
  return { success: true };
}
