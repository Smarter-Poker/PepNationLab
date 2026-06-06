/**
 * GET /api/research/widget/:slug
 * Self-contained HTML knowledge card for embedding in third-party sites.
 * Returns text/html with inline CSS and a 'Powered By Pep Nation Lab' link.
 */
import { type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const RESEARCH_NOTE =
  'For Research Use Only. This Restates Stored Laboratory Facts And Is Not Dosing Or Medical Advice.';

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const cleaned = (slug || '').toLowerCase().trim();
  if (!cleaned) {
    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/html' } });
  }
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('compounds')
    .select('slug, display_name, aliases, category, research_areas, evidence_tier, wada_status, plain_summary, mechanism, half_life')
    .eq('slug', cleaned)
    .maybeSingle();
  if (!data) {
    return new Response('<html><body><p>Compound Not Found.</p></body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  const aliases = Array.isArray(data.aliases) ? (data.aliases as string[]).slice(0, 4).join(', ') : '';
  const areas = Array.isArray(data.research_areas) ? (data.research_areas as string[]).slice(0, 3).join(' · ') : '';
  const tier = String(data.evidence_tier ?? '').replace(/_/g, ' ');
  const wada = String(data.wada_status ?? 'not_listed').replace(/_/g, ' ');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.display_name)} - Pep Nation Lab</title><style>
    :root { --bg:#050A0F; --surface:#0F1923; --surface-2:#162230; --teal:#00C4BC; --white:#FFFFFF; --silver:#A8B4C0; --silver-2:#D0DAE4; --red:#E53E3E; }
    *{box-sizing:border-box} html,body{margin:0;padding:0;background:var(--bg);color:var(--white);font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.5}
    .card{padding:18px 20px;background:linear-gradient(180deg,var(--surface) 0%,var(--surface-2) 100%);border:1px solid rgba(255,255,255,0.08);border-radius:14px;max-width:520px;margin:8px}
    .h1{font-size:18px;font-weight:700;margin:0 0 4px 0;color:var(--white);text-transform:capitalize}
    .aliases{font-size:11px;color:var(--silver);margin-bottom:10px;text-transform:capitalize}
    .row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .pill{font-size:11px;padding:3px 8px;border-radius:999px;background:rgba(0,196,188,0.12);color:var(--teal);text-transform:capitalize;letter-spacing:0.02em}
    .pill.warn{background:rgba(229,62,62,0.12);color:var(--red)}
    .summary{color:var(--silver-2);margin-bottom:10px}
    .mech{color:var(--silver);font-size:12px;margin-bottom:12px;border-left:2px solid var(--teal);padding-left:10px}
    .note{color:var(--silver);font-size:10px;padding-top:8px;margin-top:8px}
    .footer{font-size:10px;color:var(--silver);margin-top:6px;text-align:right}
    .footer a{color:var(--teal);text-decoration:none}
  </style></head><body><div class="card"><h1 class="h1">${esc(data.display_name)}</h1>${aliases ? `<div class="aliases">Also Known As ${esc(aliases)}</div>` : ''}<div class="row">${tier ? `<span class="pill">Evidence: ${esc(tier)}</span>` : ''}<span class="pill ${String(data.wada_status).includes('prohibited') ? 'warn' : ''}">WADA: ${esc(wada)}</span>${areas ? `<span class="pill">${esc(areas)}</span>` : ''}</div>${data.plain_summary ? `<p class="summary">${esc(data.plain_summary)}</p>` : ''}${data.mechanism ? `<div class="mech"><strong>Mechanism:</strong> ${esc(data.mechanism)}</div>` : ''}<div class="note">${esc(RESEARCH_NOTE)}</div><div class="footer">Powered By <a href="https://pepnationlab.com/research/compounds/${esc(cleaned)}" target="_blank" rel="noopener">Pep Nation Lab</a></div></div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors *",
    },
  });
}
