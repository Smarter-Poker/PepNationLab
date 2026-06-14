/**
 * Safe API error responses.
 *
 * Returning a raw Postgres / Supabase `error.message` to the client leaks
 * schema details (table and column names, constraint names, RLS policy hints)
 * that help an attacker map the database. Route handlers should log the real
 * error server-side and return a generic, stable message to the caller.
 *
 * Usage:
 *   const { error } = await supabase.from('x').insert(...);
 *   if (error) return safeError('reading_queue.insert', error);
 *
 *   } catch (err) {
 *     return safeError('ai_match', err);
 *   }
 */
import { NextResponse } from 'next/server';

export function safeError(
  context: string,
  err: unknown,
  status = 500,
  clientMessage = 'Something Went Wrong. Please Try Again.',
): NextResponse {
  // Full detail goes to the server logs (Vercel / Sentry) only.
  // eslint-disable-next-line no-console
  console.error(`[api-error] ${context}:`, err);
  return NextResponse.json({ error: clientMessage }, { status });
}
