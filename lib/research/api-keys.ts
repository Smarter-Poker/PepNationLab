/**
 * Server-side helpers for the /api/research/public/v1/* API.
 * Verifies bearer tokens against api_keys (sha256 hash), enforces the
 * per-minute + per-day rate ceiling via the check_api_rate_limit RPC,
 * and logs every request to api_request_log.
 */
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

export interface ApiKeyValidation {
  ok: boolean;
  key_id?: string;
  user_id?: string;
  scopes?: string[];
  reason?: 'missing' | 'malformed' | 'unknown' | 'revoked' | 'rate_limited';
}

export function hashApiKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed.slice(7).trim() || null;
  }
  return trimmed || null;
}

export async function validateApiKey(bearerToken: string | null): Promise<ApiKeyValidation> {
  const token = extractBearer(bearerToken);
  if (!token) return { ok: false, reason: 'missing' };
  if (token.length < 16 || token.length > 256) return { ok: false, reason: 'malformed' };

  try {
    const supabase = await createServiceClient();
    const hashed = hashApiKey(token);
    const { data } = await supabase
      .from('api_keys')
      .select('id, user_id, scopes, is_active, revoked_at')
      .eq('key_hash', hashed)
      .maybeSingle();
    if (!data) return { ok: false, reason: 'unknown' };
    if (data.is_active === false || data.revoked_at) return { ok: false, reason: 'revoked' };

    const { data: limitOk } = await supabase.rpc('check_api_rate_limit', { p_key_id: data.id });
    if (limitOk === false) return { ok: false, reason: 'rate_limited' };

    return {
      ok: true,
      key_id: data.id as string,
      user_id: data.user_id as string,
      scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : [],
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

export async function logApiRequest(
  key_id: string,
  endpoint: string,
  method: string,
  status: number,
  latency_ms: number,
  ip: string | null,
): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase.from('api_request_log').insert({
      api_key_id: key_id,
      endpoint: endpoint.slice(0, 256),
      method: method.slice(0, 8),
      status,
      latency_ms,
      ip: ip ? ip.slice(0, 64) : null,
    });
  } catch {
    // logging is best-effort
  }
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
  };
}

export function firstClientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}
