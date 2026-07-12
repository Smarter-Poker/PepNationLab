import { NextRequest, NextResponse } from 'next/server';
import { generateQrDataUrl } from '@/lib/qr';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Prefer ?ref= (referral code / username) -> straight-to-signup link.
  // Legacy ?slug= still supported and also points at signup for consistency.
  const ref = (searchParams.get('ref') || searchParams.get('slug') || '').trim();

  if (!ref) {
    return NextResponse.json({ error: 'Referral Code Is Required' }, { status: 400 });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')) || 'https://pepnationlab.com';
  const url = `${base}/signup?ref=${encodeURIComponent(ref)}`;

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
