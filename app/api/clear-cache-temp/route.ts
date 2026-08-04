import { revalidateTag, revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function GET() {
  revalidateTag('storefront-catalog');
  revalidateTag('catalog:eddierazz');
  revalidatePath('/', 'layout');
  return NextResponse.json({ success: true });
}
