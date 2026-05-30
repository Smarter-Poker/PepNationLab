import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verify Pep Nation Lab Webhooks | Pep Nation Lab',
  robots: { index: false, follow: false },
};

const NODE_SAMPLE = `// Node.js / Next.js — verify a Pep Nation Lab webhook
import crypto from 'crypto';

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('X-PNL-Signature') ?? '';
  const ts  = req.headers.get('X-PNL-Timestamp') ?? '';
  const secret = process.env.PNL_WEBHOOK_SECRET!;

  if (Math.abs(Date.now()/1000 - Number(ts)) > 300) {
    return new Response('stale', { status: 400 });
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(\`\${ts}.\${raw}\`)
    .digest('hex');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return new Response('bad signature', { status: 401 });
  }

  const event = JSON.parse(raw);
  return new Response('ok');
}`;

const PYTHON_SAMPLE = `# Python (Flask) — verify a Pep Nation Lab webhook
import hmac, hashlib, time, os
from flask import request, abort

SECRET = os.environ["PNL_WEBHOOK_SECRET"].encode()

@app.post("/webhooks/pnl")
def receive():
    raw = request.get_data(as_text=True)
    sig = request.headers.get("X-PNL-Signature", "")
    ts  = request.headers.get("X-PNL-Timestamp", "")

    if abs(int(time.time()) - int(ts)) > 300:
        abort(400)

    expected = "sha256=" + hmac.new(
        SECRET, f"{ts}.{raw}".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        abort(401)

    return "ok"`;

function Block({ lang, code }: { lang: string; code: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div
        style={{
          fontSize: '0.78rem',
          color: 'var(--silver)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        {lang}
      </div>
      <pre
        style={{
          background: 'var(--black-2)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--white)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          overflowX: 'auto',
          fontSize: '0.78rem',
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        }}
      >
{code}
      </pre>
    </div>
  );
}

export default async function WebhookVerifyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div style={{ padding: 'var(--space-5)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link href="/dashboard/agent" style={{ color: 'var(--teal)', fontSize: '0.85rem', textDecoration: 'none' }}>
          Back To Agent Dashboard
        </Link>
      </div>
      <h1 style={{ color: 'var(--white)', fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
        Verifying Pep Nation Lab Webhooks
      </h1>
      <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
        Every Webhook Delivery Carries Two Headers Your Receiver Must Validate Before Trusting The Payload. Copy The Sample For Your Language And Adapt The Secret Source.
      </p>

      <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', marginBottom: 'var(--space-2)' }}>Headers</h2>
      <ul style={{ color: 'var(--silver)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 'var(--space-5)' }}>
        <li><code style={{ color: 'var(--teal)' }}>X-PNL-Signature</code> — <strong>sha256=&lt;hex&gt;</strong> Of HMAC(secret, &quot;&lt;timestamp&gt;.&lt;raw body&gt;&quot;).</li>
        <li><code style={{ color: 'var(--teal)' }}>X-PNL-Timestamp</code> — Unix Seconds At Signing Time. Reject Anything Older Than 300 Seconds To Block Replay.</li>
        <li><code style={{ color: 'var(--teal)' }}>X-PNL-Delivery</code> — Unique Per-Delivery ID. Use For Idempotency.</li>
      </ul>

      <Block lang="Node.js / TypeScript" code={NODE_SAMPLE} />
      <Block lang="Python (Flask)" code={PYTHON_SAMPLE} />

      <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginTop: 'var(--space-5)' }}>
        Rotate Your Secret Anytime From The Webhooks Section Of Your Agent Dashboard. The Old Secret Stops Working Immediately On Rotate.
      </p>
    </div>
  );
}
