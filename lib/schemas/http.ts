/**
 * SERVER-ONLY request-validation helper. Do not import from client
 * components (it pulls in next/server).
 *
 * Standardizes the parse-and-reject dance every route handler needs:
 *
 *   const parsed = await parseJsonBody(req, MySchema);
 *   if (!parsed.ok) return parsed.response;
 *   const body = parsed.data; // fully typed
 *
 * Error shape is the platform-standard `{ error, details? }` envelope with
 * HTTP 400, matching what checkout already returned for invalid bodies.
 */
import { NextResponse } from 'next/server';
import type { z } from 'zod';

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  errorMessage = 'Invalid Request Data.',
): Promise<ParsedBody<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON Body.' }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: errorMessage, details: parsed.error.issues },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
