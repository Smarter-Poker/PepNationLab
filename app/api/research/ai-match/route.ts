import { NextResponse, type NextRequest } from 'next/server';
import { safeError } from '@/lib/api-error';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { parsePromptToMatchInput } from '@/lib/goal-nlp';

export const dynamic = 'force-dynamic';

// Legacy first hop of the typed-goal flow: turns a free-text prompt into the
// structured match input, which the client then sends to /api/research/match.
// The parsing itself now lives in lib/goal-nlp so /match can also accept a raw
// prompt directly (single round trip).
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const rl = await rateLimit({ key: 'research_ai_match', limit: 30, windowSeconds: 60, identifier: getClientIp(req) });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const { prompt: rawPrompt } = await req.json();
    if (!rawPrompt || typeof rawPrompt !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }
    return NextResponse.json({ result: parsePromptToMatchInput(rawPrompt) });
  } catch (error) {
    return safeError('research.ai_match', error, 500, 'Match Request Failed. Please Try Again.');
  }
}
