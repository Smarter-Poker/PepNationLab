import { readFileSync } from 'fs';
import { join } from 'path';

// The Peptide 101 course is a large static page enhanced at runtime by a stack
// of engine scripts: app.js (v3 core), v4 (depth/visuals), v5 (account-bound
// progress), v6 (practical aids), v7 (locked header + rich Modules 1-5),
// v8 (rich Modules 6-9) and v9 (rich Modules 10-13). To stop the course from
// ever silently regressing again, this route is self-healing: it serves
// whichever course file still contains the engine marker, preferring the
// primary file (public/peptide-101.html) and falling back to the byte-identical
// canonical backup (public/peptide-101.engine.html). It also guarantees every
// engine script loads even if a future edit drops its tag.
const MARKER = '/peptide-101.app.js';
const ENGINE_SCRIPTS = [
  '/peptide-101.v4.js',
  '/peptide-101.v5.js',
  '/peptide-101.v6.js',
  '/peptide-101.v7.js',
  '/peptide-101.v8.js',
  '/peptide-101.v9.js',
];

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
