/**
 * Safe API error responses.
 *
 * Returning a raw Postgres / Supabase `error.message` to the client leaks
 * schema details (table and column names, constraint names, RLS policy hints)
 * that help an attacker map the database. Route handlers should log the real
 * error server-side and return a generic, stable message to the caller.
 *
 * safeError is the sanctioned choke point for route failures: it emits a
 * structured JSON log line (greppable, machine-parseable in Vercel logs).
 * A local fallback handles diagnostic failures. Both are best-effort
 * and can never break the response path.
 *
 * Context string convention: `<area>.<route>.<method>.<step>` --
 * e.g. 'orders.POST.reserve_inventory' beats 'orders' when the same file
 * fails in more than one place.
 *
 * Usage:
 *   const { error } = await supabase.from('x').insert(...);
 *   if (error) return safeError('reading_queue.POST.insert', error);
 *
 *   } catch (err) {
 *     return safeError('ai_match.POST', err);
 *   }
 */
import { NextResponse } from 'next/server';
import { captureError } from '@/lib/errorReporting';
import { logError } from '@/lib/log';

export function safeError(
  context: string,
  err: unknown,
  status = 500,
  clientMessage = 'Something Went Wrong. Please Try Again.',
): NextResponse {
  // Full detail goes to the server logs (Vercel) only -- never to
  // the client.
  try {
    logError(`api-error.${context}`, { status }, err);
  } catch {
    captureError(err, { context, status });
  }
  return NextResponse.json({ error: clientMessage }, { status });
}
