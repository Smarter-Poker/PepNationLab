import { readFileSync } from 'fs';
import { join } from 'path';

// The Peptide 101 course is a large static page enhanced at runtime by a stack
// of engine scripts: app.js (v3 core) + v4 (depth/visuals) are loaded as cached
// <script src> from the HTML, and v5-v13 (progress, practical aids, rich module
// content, AI tutor, animations, navigation, live data) are INLINED into this
// response so the whole course arrives in a single request with no per-engine
// round trips or boot flicker.
//
// Anti-regression: this route is self-healing. It serves whichever course file
// still contains the engine marker, preferring the primary file
// (public/peptide-101.html) and falling back to the byte-identical canonical
// backup (public/peptide-101.engine.html). If an engine file cannot be read it
// degrades to a normal <script src> tag so it still loads.
const MARKER = '/peptide-101.app.js';

// Inlined in order. app.js + v4.js stay as cached external scripts (they are the
// two heaviest and benefit most from browser caching across visits).
const INLINE_ENGINES = [
  'peptide-101.v5.js',
  'peptide-101.v6.js',
  'peptide-101.v7.js',
  'peptide-101.v8.js',
  'peptide-101.v9.js',
  'peptide-101.v10.js',
  'peptide-101.v11.js',
  'peptide-101.v12.js',
  'peptide-101.v13.js',
];

function loadCourse(dir: string): string {
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
  const dir = join(process.cwd(), 'public');
  let html = loadCourse(dir);

  if (html.includes(MARKER)) {
    let blocks = '';
    for (const name of INLINE_ENGINES) {
      // Skip if the page somehow already references this engine.
      if (html.includes('/' + name)) continue;
      try {
        const js = readFileSync(join(dir, name), 'utf-8').replace(/<\/script>/gi, '<\\/script>');
        blocks += `<script>${js}</script>\n`;
      } catch {
        // Fall back to a normal network-loaded script if the file is missing.
        blocks += `<script src="/${name}"></script>\n`;
      }
    }
    if (blocks) html = html.replace('</body>', `${blocks}</body>`);
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
