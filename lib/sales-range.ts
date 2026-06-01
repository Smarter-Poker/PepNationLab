// Round 24 Sales — shared date-range parser.
// All Sales APIs accept ?range=preset|custom&start=ISO&end=ISO.

export type RangePreset = 'today' | '7d' | '30d' | 'mtd' | 'qtd' | 'ytd' | 'custom';

export function parseRange(searchParams: URLSearchParams): { start: Date; end: Date; preset: RangePreset } {
  const preset = (searchParams.get('range') as RangePreset) ?? '30d';
  const now = new Date();
  const end = new Date(now);

  if (preset === 'custom') {
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    const start = startStr ? new Date(startStr) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end: endStr ? new Date(endStr) : end, preset };
  }

  if (preset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end, preset };
  }
  if (preset === '7d') return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end, preset };
  if (preset === '30d') return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end, preset };
  if (preset === 'mtd') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end, preset };
  }
  if (preset === 'qtd') {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { start: new Date(now.getFullYear(), q, 1), end, preset };
  }
  if (preset === 'ytd') return { start: new Date(now.getFullYear(), 0, 1), end, preset };

  return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end, preset };
}

export function priorPeriod(start: Date, end: Date): { start: Date; end: Date } {
  const span = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - span), end: new Date(start.getTime()) };
}
