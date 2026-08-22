import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManufacturer } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * POST /api/manufacturer/locale -- persist the manufacturer's language
 * choice ('en' | 'zh-CN' | 'zh-TW') on their profile so every device and
 * session opens in their language. localStorage covers the device level;
 * this covers the account level.
 */
const SUPPORTED = new Set(['en', 'zh-CN', 'zh-TW']);

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const locale = typeof body?.locale === 'string' ? body.locale : '';
  if (!SUPPORTED.has(locale)) {
    return NextResponse.json({ error: 'Unsupported Locale.' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from('profiles')
    .update({ locale, updated_at: new Date().toISOString() })
    .eq('id', gate.user.id);

  if (error) {
    return NextResponse.json({ error: 'Could Not Save Language Preference.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
