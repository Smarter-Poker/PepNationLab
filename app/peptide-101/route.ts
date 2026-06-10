import { readFileSync } from 'fs';
import { join } from 'path';

// Runtime course engines, layered in order on top of the base HTML + app.js (v3) + v4.js.
// Each is an idempotent, self-booting classic script that reads app.js's top-level
// globals by bare name (sibling classic scripts share the global lexical environment)
// and wires its features on DOMContentLoaded. They MUST load after app.js and v4.js,
// so we inject them just before </body> (which comes after the in-body app.js/v4 tags).
const ENGINES = ['v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12', 'v13'] as const;

export async function GET() {
  let html = readFileSync(join(process.cwd(), 'public', 'peptide-101.html'), 'utf-8');

  // Idempotent guard: only inject if the engine layer isn't already wired into the HTML.
  if (!html.includes('peptide-101.v13.js')) {
    const tags = ENGINES.map((v) => `<script src="/peptide-101.${v}.js"></script>`).join('\n');
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${tags}\n</body>`);
    } else {
      html += tags;
    }
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
