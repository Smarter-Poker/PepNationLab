import { NextRequest, NextResponse } from 'next/server';
import { isSsrfTarget, safeFetch } from '@/lib/ssrf-guard';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

const CONFIG = {
  TIMEOUT_MS: 7000,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 800,
  MAX_BODY_SIZE: 10 * 1024 * 1024,
  CACHE_MAX_AGE: 300,
  CACHE_SWR: 600,
};

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) Version/17.4.1 Safari/605.1.15'
];

// Origin allow-list for the defense-in-depth referer check below. The platform
// serves pepnationlab.com plus two legacy aliases pointed at the same Vercel
// project, and localhost for local dev. The request's own host is additionally
// accepted at call time so Vercel preview deployments keep working without a
// code change.
const ALLOWED_PROXY_HOSTS = new Set<string>([
  'pepnationlab.com',
  'www.pepnationlab.com',
  'pepnationlabs.com',
  'www.pepnationlabs.com',
  'localhost',
  '127.0.0.1',
]);

function proxyHostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowedProxyHost(value: string | null): boolean {
  const host = proxyHostOf(value);
  return host ? ALLOWED_PROXY_HOSTS.has(host) : false;
}

// HTML-entity encode a value before interpolating it into markup. Prevents the
// reflected/stored XSS that raw ${...} interpolation of the url query param and
// upstream JSON (title/abstract/etc.) would otherwise allow.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip every executable vector out of foreign HTML: <script> blocks, inline
// on*= event handlers, and javascript: URIs. This is defense-in-depth on top of
// the nonce CSP (the CSP is the real enforcement — the browser blocks any script
// without our nonce — but stripping keeps the console clean and covers any CSP
// gaps in odd user agents).
function stripActiveContent(html: string): string {
  return html
    // Remove <script>...</script> and self-closing/void script tags entirely.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    // Remove inline event handlers: on...="...", on...='...', on...=value
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    // Neutralize javascript: in href/src attributes.
    .replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");
}

function rewriteHtml(html: string, originalUrl: string, nonce: string): string {
  const parsedUrl = new URL(originalUrl);
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

  // Remove all active/executable content from the fetched document before we
  // inject our own nonce-tagged interceptor.
  let rewritten = stripActiveContent(html);

  // Strip existing base tags
  rewritten = rewritten.replace(/<base[^>]*>/gi, '');

  // Inject base tag into head
  const baseTag = `<base href="${baseUrl}/" />`;
  if (rewritten.includes('<head>')) {
    rewritten = rewritten.replace('<head>', `<head>\n  ${baseTag}`);
  } else if (rewritten.includes('<head ')) {
    rewritten = rewritten.replace(/(<head[^>]*>)/i, `$1\n  ${baseTag}`);
  } else {
    rewritten = `<head>\n  ${baseTag}\n</head>\n` + rewritten;
  }

  // Rewrite a tags
  rewritten = rewritten.replace(/<a(\s[^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/gi, (match, before, url, after) => {
    // Ignore relative fragments or javascript protocols
    if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return match;
    }
    try {
      const absoluteUrl = new URL(url, baseUrl).toString();
      return `<a${before}href="/api/proxy?url=${encodeURIComponent(absoluteUrl)}"${after}>`;
    } catch {
      return match;
    }
  });

  // Rewrite forms
  rewritten = rewritten.replace(/<form(\s[^>]*?)action\s*=\s*["']([^"']+)["']([^>]*?)>/gi, (match, before, url, after) => {
    try {
      const absoluteUrl = new URL(url, baseUrl).toString();
      return `<form${before}action="/api/proxy?url=${encodeURIComponent(absoluteUrl)}"${after}>`;
    } catch {
      return match;
    }
  });

  // Inject Javascript interceptor. Carries our per-response nonce so it is the
  // ONLY script the CSP permits to run — every foreign script is blocked.
  const interceptorScript = `
    <script nonce="${nonce}">
      document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (link && link.href && link.href.startsWith('http') && !link.href.includes('/api/proxy')) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/api/proxy?url=' + encodeURIComponent(link.href);
        }
      }, true);
    </script>
  `;

  const badgeHtml = `
    <div style="position: fixed; bottom: 8px; right: 8px; z-index: 99999; background: rgba(0,0,0,0.7); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 10px; opacity: 0.5; pointer-events: none;">via pepnationlab.com</div>
  `;

  if (rewritten.includes('</body>')) {
    rewritten = rewritten.replace('</body>', `${interceptorScript}\n${badgeHtml}\n</body>`);
  } else {
    rewritten += `${interceptorScript}\n${badgeHtml}`;
  }

  return rewritten;
}

export async function GET(request: NextRequest) {
  // Auth gate: require a valid session - the proxy must not be usable as an
  // anonymous open web proxy that abuses server egress/bandwidth.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // Anti-SSRF check: reject non-http(s) schemes and any host that is (or
  // DNS-resolves to) a private / loopback / cloud-metadata address. safeFetch
  // below additionally re-validates every redirect hop, so a public host
  // cannot 3xx us into the internal network or the metadata endpoint.
  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    return new NextResponse('Forbidden Protocol', { status: 403 });
  }
  if (await isSsrfTarget(targetUrl.hostname)) {
    return new NextResponse('Forbidden Host', { status: 403 });
  }

  // Rate limiting via the shared limiter: Upstash-backed (cluster-wide across
  // serverless instances) when configured, with a per-process in-memory
  // fallback so a broken Upstash deploy never hard-locks the proxy. 30/min/IP.
  const ip = getClientIp(request);
  const rl = await rateLimit({ key: 'proxy', limit: 30, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return new NextResponse('Rate Limit Exceeded', {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) },
    });
  }

  // ── Proxy document hardening ────────────────────────────────────────────────
  // The proxy returns foreign HTML from the pepnationlab.com origin. Without a
  // strict Content-Security-Policy, any script in that foreign page would run in
  // OUR origin and could call /api/* with the signed-in user's cookies. We block
  // that by serving every proxy response under a nonce-based CSP: only our own
  // injected interceptor (tagged with this per-response nonce) may execute; all
  // foreign/inline scripts are refused by the browser. `base-uri` is left
  // unrestricted here on purpose because rewriteHtml injects a <base> tag that
  // relative image/style URLs depend on; script injection via <base> is moot
  // since scripts are nonce-gated regardless.
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const proxyCsp =
    "default-src 'self' https: data: blob:; " +
    "img-src 'self' https: data: blob:; " +
    "style-src 'self' https: 'unsafe-inline'; " +
    "font-src 'self' https: data:; " +
    `script-src 'nonce-${nonce}'; ` +
    "object-src 'self' https: data: blob:; " +
    "frame-ancestors 'self'; " +
    "form-action https:";
  const secureHtmlHeaders = (): Headers => {
    const h = new Headers();
    h.set('content-type', 'text/html; charset=utf-8');
    h.set('Cache-Control', `s-maxage=${CONFIG.CACHE_MAX_AGE}, stale-while-revalidate=${CONFIG.CACHE_SWR}`);
    h.set('X-Frame-Options', 'SAMEORIGIN');
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('Content-Security-Policy', proxyCsp);
    return h;
  };

  // Defense-in-depth origin check. The proxy already requires an authenticated
  // session and enforces the SSRF guard above; this additionally refuses a
  // request whose Origin or Referer belongs to a foreign site -- the case where
  // the proxy is embedded in an <iframe> on an attacker-controlled page to abuse
  // the signed-in user's session. Same-origin IframeModal loads (Origin/Referer
  // on pepnationlab.com, an alias, or a Vercel preview matching the request's own
  // host) pass; a navigation carrying neither header is allowed since the session
  // gate still applies. Skipped in development so curl-based smoke tests work.
  if (process.env.NODE_ENV !== 'development') {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const selfHost = (request.headers.get('host') || request.nextUrl.host || '')
      .split(':')[0]
      .toLowerCase();
    const matchesSelf = (value: string | null): boolean => proxyHostOf(value) === selfHost;
    const originOk = !origin || isAllowedProxyHost(origin) || matchesSelf(origin);
    const refererOk = !referer || isAllowedProxyHost(referer) || matchesSelf(referer);
    if (!originOk || !refererOk) {
      return new NextResponse('Unauthorized Referer', { status: 403 });
    }
  }

  let attempt = 0;
  let finalResponse: Response | null = null;
  let fetchError = null;

  while (attempt <= CONFIG.MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
      
      const userAgent = USER_AGENTS[attempt % USER_AGENTS.length];
      
      // safeFetch validates the target and re-validates each redirect hop
      // against the SSRF guard (follows redirects manually). An attempt that
      // resolves to an internal host throws and is treated as a fetch failure.
      const res = await safeFetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Upgrade-Insecure-Requests': '1',
          'DNT': '1'
        },
      });
      clearTimeout(timeoutId);
      finalResponse = res;
      break;
    } catch (e) {
      fetchError = e;
      attempt++;
      if (attempt <= CONFIG.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1)));
      }
    }
  }

  if (!finalResponse) {
    console.error('Proxy fetch failed after retries:', fetchError);
    return new NextResponse('Error fetching the URL', { status: 500 });
  }

  const contentType = finalResponse.headers.get('content-type') || '';
  
  // Framework Error Override: Handle non-200 safely
  if (!finalResponse.ok) {
    const isPubMed = url.includes('pubmed.ncbi.nlm.nih.gov');
    if (isPubMed && finalResponse.status === 403) {
      const pmidMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
      if (pmidMatch && pmidMatch[1]) {
        try {
          const pubRes = await fetch(`https://www.ncbi.nlm.nih.gov/research/pubtator-api/publications/export/biocjson?pmids=${pmidMatch[1]}`);
          if (pubRes.ok) {
            const text = await pubRes.text();
            const data = JSON.parse(text.trim().split('\\n')[0]);
            if (data?.PubTator3?.[0]) {
              const pubData = data.PubTator3[0];
              const passages = pubData.passages || [];
              const titlePassage = passages.find((p: { infons?: { type?: string, authors?: string, journal?: string }, text?: string }) => p.infons?.type === 'title') || passages[0];
              const abstractPassage = passages.find((p: { infons?: { type?: string, authors?: string, journal?: string }, text?: string }) => p.infons?.type === 'abstract') || passages[1];
              
              const title = titlePassage?.text || 'PubMed Article';
              const abstract = abstractPassage?.text || '';
              const authors = titlePassage?.infons?.authors || '';
              const journal = titlePassage?.infons?.journal || '';

              // All interpolated values are HTML-escaped: `url` is attacker-
              // controlled (query param) and title/authors/journal/abstract come
              // from an external JSON API, so none may be trusted as raw markup.
              const fallbackHtml = `
                <!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #333; line-height: 1.6; padding: 20px; margin: 0; }
                  .container { max-width: 800px; margin: 0 auto; }
                  h1 { font-size: 24px; color: #111; margin-bottom: 10px; }
                  .meta { font-size: 14px; color: #666; margin-bottom: 20px; font-style: italic; }
                  .abstract { font-size: 16px; color: #222; white-space: pre-wrap; }
                  .badge { display: inline-block; background: #00C4BC; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 20px; }
                </style>
                </head>
                <body>
                  <div class="container">
                    <div class="badge">PubMed Reader Proxy</div>
                    <h1>${escapeHtml(title)}</h1>
                    <div class="meta">${escapeHtml(authors)}<br>${escapeHtml(journal)}</div>
                    <div class="abstract">${escapeHtml(abstract)}</div>
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                      <a href="/api/proxy?url=${encodeURIComponent(url)}" rel="noopener noreferrer" style="color: #00C4BC; text-decoration: none; font-weight: bold;">View Original on PubMed</a>
                    </div>
                  </div>
                </body></html>
              `;
              return new NextResponse(fallbackHtml, { status: 200, headers: secureHtmlHeaders() });
            }
          }
        } catch (e) {
          console.error("PubMed fallback failed:", e);
        }
      }
    }

    if (contentType.includes('text/html')) {
      const fallbackHtml = `
        <!DOCTYPE html><html><head><title>Content Unavailable</title></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0F161E; color: #FFF; margin: 0;">
          <div style="text-align: center; max-width: 400px; padding: 20px;">
            <h2>Article Unavailable</h2>
            <p style="color: #A8B4C0; font-size: 14px;">The publisher returned a ${escapeHtml(String(finalResponse.status))} error.</p>
            <p style="color: #A8B4C0; font-size: 14px;">This usually happens when the publisher actively blocks proxy requests.</p>
            <a href="/api/proxy?url=${encodeURIComponent(url)}" rel="noopener noreferrer" style="display: inline-block; margin-top: 15px; background: #00C4BC; color: #000; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-weight: bold;">Reload Source</a>
          </div>
        </body></html>
      `;
      // We return 200 OK so Next.js doesn't strip our headers!
      return new NextResponse(fallbackHtml, { status: 200, headers: secureHtmlHeaders() });
    } else {
      return new NextResponse(`Publisher error ${finalResponse.status}`, { status: 500 });
    }
  }

  if (contentType.includes('text/html')) {
    let html = await finalResponse.text();
    html = rewriteHtml(html, url, nonce);
    // secureHtmlHeaders() applies the nonce CSP so no foreign script can run in
    // our origin, plus nosniff / X-Frame-Options / caching.
    return new NextResponse(html, { status: 200, headers: secureHtmlHeaders() });
  } else {
    // Binary/other content (images, PDFs, etc.). Preserve the upstream
    // content-type but strip any upstream framing/CSP headers and re-apply our
    // own. The nonce CSP also neutralizes script-carrying SVGs, and nosniff
    // stops the browser from re-interpreting the bytes as active HTML.
    const headers = new Headers();
    const upstreamType = finalResponse.headers.get('content-type');
    if (upstreamType) headers.set('content-type', upstreamType);
    headers.set('Cache-Control', `s-maxage=${CONFIG.CACHE_MAX_AGE}, stale-while-revalidate=${CONFIG.CACHE_SWR}`);
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', proxyCsp);
    const arrayBuffer = await finalResponse.arrayBuffer();
    return new NextResponse(arrayBuffer, { status: 200, headers });
  }
}
