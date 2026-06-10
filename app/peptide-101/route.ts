import { readFileSync } from 'fs';
import { join } from 'path';

// The Peptide 101 course is a large static page enhanced at runtime by
// /peptide-101.app.js (v3), /peptide-101.v4.js (v4 depth/visuals) and
// /peptide-101.v5.js (v5 account-bound progress). To stop the course from
// ever silently regressing again, this route is self-healing: it serves
// whichever course file still contains the engine marker, preferring the
// primary file (public/peptide-101.html) and falling back to the byte-identical
// canonical backup (public/peptide-101.engine.html). It also guarantees the
// v4/v5 engines load even if a future edit drops their script tags.
const MARKER = '/peptide-101.app.js';
const ENGINE_SCRIPTS = ['/peptide-101.v4.js', '/peptide-101.v5.js'];

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
  // Safety net: guarantee each engine script loads even if a future edit drops it.
  if (html.includes(MARKER)) {
    let inject = '';
    for (const src of ENGINE_SCRIPTS) {
      if (!html.includes(src)) inject += `<script src="${src}"></script>\n`;
    }
    if (inject) html = html.replace('</body>', `${inject}</body>`);
  }
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
