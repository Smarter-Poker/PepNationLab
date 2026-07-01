import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  let html: string;
  try {
    html = await readFile(join(process.cwd(), 'public', 'peptide-101.html'), 'utf-8');
  } catch (err) {
    console.error('Failed to read peptide-101.html:', err);
    return new Response('Course content unavailable', { status: 503 });
  }

  // Cache-bust ALL static course scripts so users always get the latest version.
  const v = Date.now();
  html = html.replace(/\/peptide-101\.app\.js/g, `/peptide-101.app.js?v=${v}`);
  html = html.replace(/\/peptide-101\.v4\.js/g,  `/peptide-101.v4.js?v=${v}`);

  // Inject v14 engine (with cache-bust) if not already present in the HTML.
  if (!html.includes('<script src="/peptide-101.v14.js')) {
    const tag = `<script src="/peptide-101.v14.js?v=${v}"></script>`;
    html = html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : html + tag;
  } else {
    // Already present — still bust its cache.
    html = html.replace(/\/peptide-101\.v14\.js(\?v=\d+)?/g, `/peptide-101.v14.js?v=${v}`);
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Never serve a cached copy — course content changes frequently.
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}
