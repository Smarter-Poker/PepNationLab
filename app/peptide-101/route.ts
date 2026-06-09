import { readFileSync } from 'fs';
import { join } from 'path';

// The Peptide 101 course is a large static page enhanced at runtime by
// /peptide-101.app.js (v3) and /peptide-101.v4.js (v4). To stop the course
// from ever silently regressing again, this route is self-healing: it serves
// whichever course file still contains the engine marker, preferring the
// primary file (public/peptide-101.html) and falling back to the byte-identical
// canonical backup (public/peptide-101.engine.html).
const MARKER = '/peptide-101.app.js';
const V4_TAG = '<script src="/peptide-101.v4.js"></script>';

function loadCourse(): string {
  const dir = join(process.cwd(), 'public');
  let fallback = '';
  for (const name of ['peptide-101.html', 'peptide-101.engine.html']) {
    try {
      const html = readFileSync(join(dir, name), 'utf-8');
      if (html.includes(MARKER)) return html;
      if (!fallback) fallback = html;
    } catch {
      // try the next candidate
    }
  }
  return fallback;
}

export async function GET() {
  let html = loadCourse();
  // Safety net: guarantee the v4 engine loads even if a future edit drops the tag.
  if (html.includes(MARKER) && !html.includes('/peptide-101.v4.js')) {
    html = html.replace('</body>', `${V4_TAG}\n</body>`);
  }
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
