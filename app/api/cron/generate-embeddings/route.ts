import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { safeError } from '@/lib/api-error';
import { assertCronAuth } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  // Vector embedding generation requires a dedicated embedding model API.
  // This route is intentionally disabled until an embedding provider is configured.
  // Keyword search (ts_rank_cd + trigram) remains fully functional.
  return NextResponse.json(
    { message: 'Embedding generation is currently disabled. Keyword search is active.' },
    { status: 200 }
  );
}
