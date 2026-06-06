/**
 * /research/api-docs
 * Public documentation page for the /api/research/public/v1/* endpoints.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Research API Documentation - Pep Nation Lab',
  description: 'Public Research API V1 - Endpoints, Authentication, And Rate Limits.',
  robots: { index: true, follow: true },
};

export default function ApiDocsPage() {
  return (
    <main className="container" style={{ padding: '40px 20px', maxWidth: 880, margin: '0 auto' }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Research API Documentation</h1>
      <p style={{ color: 'var(--text-secondary, #A8B4C0)', marginBottom: 32 }}>
        Public, Read-Only Access To The Pep Nation Lab Research Library. For Research Use Only.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Authentication</h2>
        <p>Every Request Requires A Bearer Token In The Authorization Header:</p>
        <pre style={{ background: 'var(--surface, #0F1923)', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`Authorization: Bearer YOUR_API_KEY`}
        </pre>
        <p>Admins Can Generate Keys At <Link href="/admin/api-keys">/admin/api-keys</Link>.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Rate Limits</h2>
        <ul>
          <li>Per-Minute Limit Enforced Server-Side Via check_api_rate_limit.</li>
          <li>Per-Day Limit Enforced Server-Side Via check_api_rate_limit.</li>
          <li>Exceeding Either Returns HTTP 429 With Body {`{ "error": "rate_limited" }`}.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Endpoints</h2>

        <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>GET /api/research/public/v1/compounds</h3>
        <p>Paginated List Of Compounds. Query Params: <code>limit</code> (1-100, default 25), <code>offset</code>.</p>
        <pre style={{ background: 'var(--surface, #0F1923)', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://pepnationlab.com/api/research/public/v1/compounds?limit=25`}
        </pre>

        <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>GET /api/research/public/v1/compounds/:slug</h3>
        <p>Full Compound JSON Including References, Trials, And Orthologs.</p>
        <pre style={{ background: 'var(--surface, #0F1923)', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://pepnationlab.com/api/research/public/v1/compounds/bpc-157`}
        </pre>

        <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>GET /api/research/public/v1/search</h3>
        <p>Ranked Full-Text Search. Query Params: <code>q</code>, <code>limit</code>, <code>offset</code>.</p>
        <pre style={{ background: 'var(--surface, #0F1923)', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://pepnationlab.com/api/research/public/v1/search?q=glp-1"`}
        </pre>

        <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>POST /api/research/public/v1/match</h3>
        <p>Suggestion Engine. Body: <code>{`{ goal, comfort, wada, risk, limit }`}</code>.</p>
        <pre style={{ background: 'var(--surface, #0F1923)', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"goal":"healing","comfort":"clinical"}' \\
  https://pepnationlab.com/api/research/public/v1/match`}
        </pre>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Embed Widget</h2>
        <p>Drop The Knowledge Card Into Any Page With A Simple Iframe:</p>
        <pre style={{ background: 'var(--surface, #0F1923)', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`<iframe src="https://pepnationlab.com/api/research/widget/bpc-157"
        width="540" height="360" frameborder="0"></iframe>`}
        </pre>
      </section>

      <p style={{ color: 'var(--text-secondary, #A8B4C0)', fontSize: 12 }}>
        For Research Use Only. This Restates Stored Laboratory Facts And Is Not Dosing Or Medical Advice.
      </p>
    </main>
  );
}
