/**
 * Supabase nested relations come back as an array even on FK joins that
 * should yield a single row. Use pickOne to normalize either shape into
 * a single value (or null when the relation is missing/empty).
 */
export function pickOne<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}
