/**
 * GET /feed.xml
 * RSS feed of the editorial research guides plus the 50 most recent compounds
 * and the 50 most recent compound_references rows. Guides are the most
 * editorially valuable, most citation-worthy content on the site, so they lead
 * the feed - feed readers and AI freshness crawlers (which poll RSS) never saw
 * them before.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { GUIDES } from '@/lib/research/guides';

export const dynamic = 'force-dynamic';

const BASE = 'https://pepnationlab.com';

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toRfc822(iso: string | null): string {
  if (!iso) return new Date().toUTCString();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export async function GET() {
  const supabase = await createServiceClient();
  const items: Array<{ title: string; link: string; pubDate: string; description: string; guid: string }> = [];

  // Editorial research guides - static content, always available (no DB call).
  for (const g of GUIDES) {
    items.push({
      title: `Research Guide: ${g.title}`,
      link: `${BASE}/research/guides/${g.slug}`,
      pubDate: toRfc822(g.dateModified || g.datePublished),
      description: g.description,
      guid: `${BASE}/research/guides/${g.slug}`,
    });
  }

  try {
    const { data: compounds } = await supabase
      .from('compounds')
      .select('slug, display_name, plain_summary, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    for (const c of ((compounds ?? []) as Array<{ slug: string; display_name: string; plain_summary: string | null; created_at: string | null }>)) {
      items.push({
        title: `New Compound: ${c.display_name}`,
        link: `${BASE}/research/${c.slug}`,
        pubDate: toRfc822(c.created_at),
        description: c.plain_summary ?? '',
        guid: `${BASE}/research/${c.slug}#compound`,
      });
    }
  } catch {
    // best-effort
  }

  try {
    const { data: refs } = await supabase
      .from('compound_references')
      .select('compound_slug, title, source_type:source, url, added_at:created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    for (const r of ((refs ?? []) as Array<{ compound_slug: string; title: string | null; source_type: string; url: string | null; added_at: string | null }>)) {
      items.push({
        title: `New Evidence (${r.source_type}): ${r.title ?? r.compound_slug}`,
        link: r.url ?? `${BASE}/research/${r.compound_slug}`,
        pubDate: toRfc822(r.added_at),
        description: `New ${r.source_type} Reference Added For ${r.compound_slug}.`,
        guid: `${BASE}/research/${r.compound_slug}#${r.source_type}-${r.added_at}`,
      });
    }
  } catch {
    // best-effort
  }

  // Newest first so feed readers and freshness crawlers surface recent updates.
  items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Pep Nation Lab Research Library</title>
    <link>${BASE}/research</link>
    <description>New Compounds And Evidence Updates From The Pep Nation Lab Research Library.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.map((it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="false">${esc(it.guid)}</guid>
      <pubDate>${it.pubDate}</pubDate>
      <description>${esc(it.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900, stale-while-revalidate=3600',
    },
  });
}
