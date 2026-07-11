import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Guards for Supabase query results.
 *
 * Motivation: many server routes destructure `const { data } = await supabase...`
 * and silently drop the `error`, so RLS denials, constraint failures, and network
 * errors surface as empty/stale reads or writes that appear to succeed while
 * nothing persisted. `unwrap` throws a typed error (with context) so a single
 * outer try/catch in the route can log it and return a safe 500.
 *
 * IMPORTANT: only use these inside a route that already has a try/catch returning
 * a safe response. Do NOT use them for best-effort / fire-and-forget writes
 * (e.g. audit-log inserts) where a throw would abort the primary operation.
 */

export class SupabaseQueryError extends Error {
  constructor(
    public readonly context: string,
    public readonly pgError: PostgrestError,
  ) {
    super(`[${context}] ${pgError.message}`);
    this.name = 'SupabaseQueryError';
  }
}

/** Throw on `{ error }`, otherwise return `data`. */
export async function unwrap<T>(
  context: string,
  builder: PromiseLike<{ data: T; error: PostgrestError | null }>,
): Promise<T> {
  const { data, error } = await builder;
  if (error) throw new SupabaseQueryError(context, error);
  return data;
}

/** maybeSingle() variant: a null row is allowed (returns null, not a throw). */
export async function unwrapMaybe<T>(
  context: string,
  builder: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<T | null> {
  const { data, error } = await builder;
  if (error) throw new SupabaseQueryError(context, error);
  return data;
}
