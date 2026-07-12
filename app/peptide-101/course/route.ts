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

  // Cache-bust ALL static course scripts per DEPLOY (not per request).
  // Date.now() forced a full re-download of every course engine on every
  // visit; the commit SHA changes exactly when the scripts can change.
  const v = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'dev';
  html = html.replace(/\/peptide-101\.app\.js/g, `/peptide-101.app.js?v=${v}`);
  html = html.replace(/\/peptide-101\.v4\.js/g,  `/peptide-101.v4.js?v=${v}`);

  // Inject v14 engine (with cache-bust) if not already present in the HTML.
  if (!html.includes('<script src="/peptide-101.v14.js')) {
    const tag = `<script src="/peptide-101.v14.js?v=${v}"></script>`;
    html = html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : html + tag;
  } else {
    // Already present - still bust its cache.
    html = html.replace(/\/peptide-101\.v14\.js(\?v=\d+)?/g, `/peptide-101.v14.js?v=${v}`);
  }

  // SEO head fixes injected here (the 200KB static HTML is easier to manage
  // when head tags are maintained in one place): canonical, and a real
  // title/description instead of the thin defaults baked into the file.
  html = html.replace(
    /<title>[^<]*<\/title>/,
    '<title>Peptide 101 Course | The Complete Beginner Guide To Research Peptides | Pep Nation Lab</title>',
  );
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    '<meta name="description" content="Fourteen interactive modules covering what peptides are, peptide families, laboratory handling, storage, reconstitution, quality verification, and research-use legality. Research Use Only.">',
  );
  if (!html.includes('rel="canonical"')) {
    html = html.replace(
      '</head>',
      '<link rel="canonical" href="https://pepnationlab.com/peptide-101/course">\n</head>',
    );
  }

  // Inject the certificate upgrade (dynamic name entry + printable cert on s15).
  // Loaded last so it runs after the course engines have registered s15.
  if (!html.includes('<script src="/peptide-101.cert.js')) {
    const certTag = `<script src="/peptide-101.cert.js?v=${v}"></script>`;
    html = html.includes('</body>') ? html.replace('</body>', `${certTag}\n</body>`) : html + certTag;
  } else {
    html = html.replace(/\/peptide-101\.cert\.js(\?v=\d+)?/g, `/peptide-101.cert.js?v=${v}`);
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short CDN cache + stale-while-revalidate: course content only changes
      // on deploy (scripts are SHA-busted above), so no-store was pure
      // re-download cost on every mobile visit.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
