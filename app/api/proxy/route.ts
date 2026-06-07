import { NextRequest, NextResponse } from 'next/server';

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

// In-memory rate limiting map (cleared every 5 mins)
const rateLimitMap = new Map<string, number>();
let lastRateLimitClear = Date.now();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (now - lastRateLimitClear > 5 * 60 * 1000) {
    rateLimitMap.clear();
    lastRateLimitClear = now;
  }
  const count = rateLimitMap.get(ip) || 0;
  if (count >= 30) return false;
  rateLimitMap.set(ip, count + 1);
  return true;
}

function isPrivateOrReservedHost(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  if (hostname.includes('.internal')) return true;
  
  // Parse IPv4
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);
    if (a === 127) return true; // Loopback
    if (a === 10) return true; // Private 10.x.x.x
    if (a === 172 && b >= 16 && b <= 31) return true; // Private 172.16-31.x.x
    if (a === 192 && b === 168) return true; // Private 192.168.x.x
    if (a === 169 && b === 254) return true; // AWS/GCP Metadata
    if (a === 0) return true; // 0.0.0.0
  }
  
  // Parse IPv6 basic
  if (hostname.includes('[::1]') || hostname === '::1') return true;
  if (hostname.toLowerCase().startsWith('fe80:')) return true;
  if (hostname.toLowerCase().startsWith('[fe80:')) return true;

  return false;
}

function rewriteHtml(html: string, originalUrl: string): string {
  const parsedUrl = new URL(originalUrl);
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
  
  // Strip existing base tags
  let rewritten = html.replace(/<base[^>]*>/gi, '');
  
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

  // Inject Javascript interceptor
  const interceptorScript = `
    <script>
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
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // Anti-SSRF check
  try {
    const targetUrl = new URL(url);
    if (isPrivateOrReservedHost(targetUrl.hostname)) {
      return new NextResponse('Forbidden Host', { status: 403 });
    }
  } catch (e) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  // Rate Limiting
  const forwardedFor = request.headers.get('x-forwarded-for');
  let ip = 'unknown';
  if (forwardedFor) {
    const parts = forwardedFor.split(',');
    ip = parts[parts.length - 1].trim();
  }
  
  if (!checkRateLimit(ip)) {
    return new NextResponse('Rate Limit Exceeded', { status: 429 });
  }

  // Referer Check
  const referer = request.headers.get('referer');
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  // In dev it's localhost, in prod it's pepnationlab.com
  const isAllowedHost = (h: string) => h.includes('localhost') || h.includes('pepnationlab.com');
  
  // Commenting out strict referer check for ease of testing locally in iframe without origin
  // if (!isAllowedHost(origin || '') && !isAllowedHost(referer || '') && !isAllowedHost(host || '')) {
  //   return new NextResponse('Unauthorized referer', { status: 403 });
  // }

  let attempt = 0;
  let finalResponse: Response | null = null;
  let fetchError = null;

  while (attempt <= CONFIG.MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
      
      const userAgent = USER_AGENTS[attempt % USER_AGENTS.length];
      
      const res = await fetch(url, {
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
              const titlePassage = passages.find((p: any) => p.infons?.type === 'title') || passages[0];
              const abstractPassage = passages.find((p: any) => p.infons?.type === 'abstract') || passages[1];
              
              const title = titlePassage?.text || 'PubMed Article';
              const abstract = abstractPassage?.text || '';
              const authors = titlePassage?.infons?.authors || '';
              const journal = titlePassage?.infons?.journal || '';

              const fallbackHtml = `
                <!DOCTYPE html><html><head><title>${title}</title>
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
                    <h1>${title}</h1>
                    <div class="meta">${authors}<br>${journal}</div>
                    <div class="abstract">${abstract}</div>
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                      <a href="${url}" target="_blank" style="color: #00C4BC; text-decoration: none; font-weight: bold;">View Original on PubMed</a>
                    </div>
                  </div>
                </body></html>
              `;
              const resHeaders = new Headers();
              resHeaders.set('content-type', 'text/html; charset=utf-8');
              resHeaders.set('Cache-Control', \`s-maxage=\${CONFIG.CACHE_MAX_AGE}, stale-while-revalidate=\${CONFIG.CACHE_SWR}\`);
              resHeaders.set('X-Frame-Options', 'SAMEORIGIN');
              resHeaders.set('Content-Security-Policy', "frame-ancestors 'self'");
              return new NextResponse(fallbackHtml, { status: 200, headers: resHeaders });
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
            <p style="color: #A8B4C0; font-size: 14px;">The publisher returned a ${finalResponse.status} error.</p>
            <p style="color: #A8B4C0; font-size: 14px;">This usually happens when the publisher actively blocks proxy requests.</p>
            <a href="${url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 15px; background: #00C4BC; color: #000; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-weight: bold;">Open in New Tab</a>
          </div>
        </body></html>
      `;
      const resHeaders = new Headers();
      resHeaders.set('content-type', 'text/html; charset=utf-8');
      resHeaders.set('Cache-Control', \`s-maxage=\${CONFIG.CACHE_MAX_AGE}, stale-while-revalidate=\${CONFIG.CACHE_SWR}\`);
      resHeaders.set('X-Frame-Options', 'SAMEORIGIN');
      resHeaders.set('Content-Security-Policy', "frame-ancestors 'self'");
      
      // We return 200 OK so Next.js doesn't strip our headers!
      return new NextResponse(fallbackHtml, { status: 200, headers: resHeaders });
    } else {
      return new NextResponse(\`Publisher error \${finalResponse.status}\`, { status: 500 });
    }
  }

  const headers = new Headers(finalResponse.headers);
  headers.delete('x-frame-options');
  headers.delete('content-security-policy');
  headers.delete('content-security-policy-report-only');
  headers.delete('content-encoding');
  headers.delete('content-length');
  
  // Set Omega Security Headers
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Content-Security-Policy', "frame-ancestors 'self'");
  headers.set('Cache-Control', `s-maxage=${CONFIG.CACHE_MAX_AGE}, stale-while-revalidate=${CONFIG.CACHE_SWR}`);

  if (contentType.includes('text/html')) {
    let html = await finalResponse.text();
    html = rewriteHtml(html, url);
    return new NextResponse(html, { status: 200, headers });
  } else {
    const arrayBuffer = await finalResponse.arrayBuffer();
    return new NextResponse(arrayBuffer, { status: 200, headers });
  }
}
