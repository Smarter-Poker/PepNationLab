import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { hashApiKey } from '@/lib/research/api-keys';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function generateKey(formData: FormData) {
  'use server';
  const gate = await requireAdmin();
  if (!gate.ok) throw new Error('Unauthorized');
  const label = String(formData.get('label') ?? '').slice(0, 120).trim() || 'Unnamed Key';
  const plaintext = `pnl_${crypto.randomBytes(24).toString('hex')}`;
  const supabase = createAdminClient();
  const { error } = await supabase.from('api_keys').insert({
    user_id: gate.userId,
    name: label,
    key_hash: hashApiKey(plaintext),
    scopes: ['research:read'],
    is_active: true,
    key_prefix: plaintext.slice(0, 12) + '...',
  });
  if (error) throw new Error('Failed To Generate Key');
  revalidatePath('/admin/api-keys');
  const jar = await cookies();
  jar.set('pnl_new_api_key', plaintext, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 120, path: '/admin/api-keys' });
  redirect('/admin/api-keys');
}

async function revokeKey(formData: FormData) {
  'use server';
  const gate = await requireAdmin();
  if (!gate.ok) throw new Error('Unauthorized');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from('api_keys').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error('Failed To Revoke Key');
  revalidatePath('/admin/api-keys');
}

export default async function ApiKeysPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, is_active, created_at, revoked_at, last_used_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const jar = await cookies();
  const newKey = jar.get('pnl_new_api_key')?.value ?? null;
  if (newKey) jar.delete('pnl_new_api_key');

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', marginBottom: 8 }}>API Keys</h1>
      <p style={{ color: 'var(--text-secondary, #A8B4C0)', marginBottom: 24 }}>Manage Bearer Tokens For The Public Research API V1.</p>
      {newKey ? (
        <div style={{ padding: 16, border: '1px solid #00C4BC', borderRadius: 8, marginBottom: 24, background: 'rgba(0,196,188,0.06)' }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>New Key Generated - Copy It Now (Shown Only Once)</p>
          <code style={{ display: 'block', padding: 12, background: '#050A0F', borderRadius: 6, wordBreak: 'break-all' }}>{newKey}</code>
        </div>
      ) : null}
      <form action={generateKey} style={{ marginBottom: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input name="label" placeholder="Key Label (E.g. Research Partner A)" required maxLength={120} style={{ flex: 1, minWidth: 240, padding: '10px 12px', borderRadius: 6, border: '1px solid #1D2D3E', background: '#0F1923', color: '#FFF' }} />
        <button type="submit" className="btn-primary" style={{ padding: '10px 18px', borderRadius: 6, background: '#00C4BC', color: '#050A0F', fontWeight: 700, border: 'none' }}>Generate Key</button>
      </form>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Active Keys</h2>
      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #1D2D3E' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#162230', textAlign: 'left' }}><th style={{ padding: 12 }}>Label</th><th style={{ padding: 12 }}>Preview</th><th style={{ padding: 12 }}>Created</th><th style={{ padding: 12 }}>Last Used</th><th style={{ padding: 12 }}>Status</th><th style={{ padding: 12 }}>Action</th></tr></thead>
          <tbody>
            {(data ?? []).map((k: Record<string, unknown>) => (
              <tr key={String(k.id)} style={{ borderTop: '1px solid #1D2D3E' }}>
                <td style={{ padding: 12 }}>{String(k.name ?? '')}</td>
                <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>{String(k.key_prefix ?? '')}</td>
                <td style={{ padding: 12, fontSize: 12 }}>{String(k.created_at ?? '').slice(0, 10)}</td>
                <td style={{ padding: 12, fontSize: 12 }}>{k.last_used_at ? String(k.last_used_at).slice(0, 10) : 'Never'}</td>
                <td style={{ padding: 12 }}>{k.is_active ? 'Active' : 'Revoked'}</td>
                <td style={{ padding: 12 }}>{k.is_active ? (<form action={revokeKey}><input type="hidden" name="id" value={String(k.id)} /><button type="submit" style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', color: '#E53E3E', border: '1px solid #E53E3E', cursor: 'pointer' }}>Revoke</button></form>) : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
