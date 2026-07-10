import { NextRequest, NextResponse } from 'next/server';
import { generateQrDataUrl } from '@/lib/qr';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug') ?? '';

  if (!slug) {
    return NextResponse.json({ error: 'Slug Is Required' }, { status: 400 });
  }

  const url = `https://pepnationlab.com?ref=${encodeURIComponent(slug)}`;

  try {
    const dataUrl = await generateQrDataUrl(url);
    // dataUrl is "data:image/png;base64,..."
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err) {
    console.error('QR Generation Error:', err);
    return NextResponse.json({ error: 'Failed To Generate QR Code' }, { status: 500 });
  }
}
