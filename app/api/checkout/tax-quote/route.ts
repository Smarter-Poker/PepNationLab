import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { computeTaxQuote } from '@/lib/tax';

const QuoteSchema = z.object({
  subtotal: z.number().min(0),
  shipping: z.number().min(0).default(0),
  shippingState: z.string().min(2).max(2).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 });
  }

  const limited = await rateLimit({
    key: 'tax_quote',
    limit: 60,
    windowSeconds: 60,
    identifier: user.id,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Wait And Try Again.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 });
  }

  const parsed = QuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Tax Quote Payload.', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const service = await createServiceClient();
  try {
    const quote = await computeTaxQuote(service, {
      buyerId: user.id,
      subtotal: parsed.data.subtotal,
      shipping: parsed.data.shipping ?? 0,
      shippingState: parsed.data.shippingState ?? null,
    });
    return NextResponse.json({ data: quote });
  } catch (err: unknown) {
    console.error('Tax Quote Failed:', err);
    return NextResponse.json(
      { data: { taxableAmount: 0, rate: 0, taxAmount: 0, jurisdiction: null, exempt: false, exemptionId: null } },
      { status: 200 }
    );
  }
}
