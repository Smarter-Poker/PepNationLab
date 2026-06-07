import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    
    // We want to pass back the headers but strip out the ones that prevent iframing
    const headers = new Headers(response.headers);
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.delete('content-security-policy-report-only');
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('access-control-allow-origin', '*');
    
    // If it's an HTML page, we fetch the text and inject a base tag
    if (contentType.includes('text/html')) {
      let html = await response.text();
      
      // Inject base tag right after <head> to fix relative links
      const parsedUrl = new URL(url);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      
      const baseTag = `<base href="${baseUrl}/" />`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>\n  ${baseTag}`);
      } else if (html.includes('<head ')) {
        html = html.replace(/(<head[^>]*>)/i, `$1\n  ${baseTag}`);
      } else {
        html = `<head>\n  ${baseTag}\n</head>\n` + html;
      }

      return new NextResponse(html, {
        status: response.status,
        headers,
      });
    } else {
      // For non-HTML (like PDFs), we just pipe it through
      const arrayBuffer = await response.arrayBuffer();
      
      return new NextResponse(arrayBuffer, {
        status: response.status,
        headers,
      });
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Error fetching the URL', { status: 500 });
  }
}
