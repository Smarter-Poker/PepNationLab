import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const GROK_API_KEY = process.env.GROK_API_KEY;

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'ask_ai_proxy', limit: 5, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (!GROK_API_KEY) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();

    // Convert Gemini-style request body to OpenAI-compatible format for Grok
    const messages: Array<{ role: string; content: string }> = [];

    // Handle both camelCase (client sends) and snake_case field names
    const sysInstruction = body.systemInstruction ?? body.system_instruction;
    if (sysInstruction?.parts?.[0]?.text) {
      messages.push({ role: 'system', content: sysInstruction.parts[0].text });
    }

    if (Array.isArray(body.contents)) {
      for (const turn of body.contents) {
        const role = turn.role === 'model' ? 'assistant' : (turn.role ?? 'user');
        const text = Array.isArray(turn.parts) ? turn.parts.map((p: { text?: string }) => p.text ?? '').join('') : '';
        if (text) messages.push({ role, content: text });
      }
    } else if (typeof body.contents === 'string') {
      messages.push({ role: 'user', content: body.contents });
    }

    // Cap total request size to prevent API cost amplification from a single large payload.
    const MAX_CHARS = 20_000;
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > MAX_CHARS) {
      return NextResponse.json({ error: 'Request too large' }, { status: 400 });
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    // Return in Gemini-compatible shape so the client doesn't need changes
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const text = data.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({
      candidates: [{ content: { parts: [{ text }], role: 'model' } }],
    });
  } catch (err) {
    console.error('ask-ai proxy error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
