import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  let html = readFileSync(join(process.cwd(), 'public', 'peptide-101.html'), 'utf-8');

  // Load the v14 paginated module engine after the in-body app.js + v4.js.
  if (!html.includes('peptide-101.v14.js')) {
    const tag = '<script src="/peptide-101.v14.js"></script>';
    html = html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : html + tag;
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
