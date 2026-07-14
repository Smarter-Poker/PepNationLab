'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailTemplate {
  template_key: string;
  label: string;
  description: string;
  subject_override: string | null;
  body_override: string | null;
  available_vars: string[];
  updated_at: string | null;
}

interface BlastResult {
  sent: number;
  failed: number;
  total: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlaceholderChip({ label }: { label: string }) {
  return (
    <code
      style={{
        display: 'inline-block',
        background: '#0A1520',
        border: '1px solid #1C3050',
        borderRadius: 4,
        padding: '1px 7px',
        fontSize: 12,
        color: '#00C4BC',
        fontFamily: 'monospace',
        marginRight: 4,
        marginBottom: 4,
        cursor: 'default',
        userSelect: 'all',
      }}
    >
      {label}
    </code>
  );
}

function TemplateCard({
  template,
  onSave,
}: {
  template: EmailTemplate;
  onSave: (key: string, subject: string, body: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(template.subject_override ?? '');
  const [body, setBody] = useState(template.body_override ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isCartRecovery = template.template_key === 'cart_recovery';
  const hasOverride = !!(template.subject_override || template.body_override);

  const handleSave = async () => {
    setSaving(true);
    await onSave(template.template_key, subject, body);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = async () => {
    setClearing(true);
    await onSave(template.template_key, '', '');
    setSubject('');
    setBody('');
    setClearing(false);
  };

  return (
    <div
      style={{
        background: '#07111C',
        border: `1px solid ${hasOverride ? '#00C4BC44' : '#1C2D3F'}`,
        borderRadius: 10,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <button
        onClick={() => !isCartRecovery && setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'none',
          border: 'none',
          cursor: isCartRecovery ? 'default' : 'pointer',
          textAlign: 'left',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E2EAF0' }}>
              {template.label}
            </span>
            {hasOverride && (
              <span
                style={{
                  fontSize: 11,
                  background: '#00C4BC22',
                  color: '#00C4BC',
                  border: '1px solid #00C4BC44',
                  borderRadius: 20,
                  padding: '1px 8px',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                }}
              >
                CUSTOM
              </span>
            )}
            {isCartRecovery && (
              <span
                style={{
                  fontSize: 11,
                  background: '#1A2030',
                  color: '#8B95A3',
                  border: '1px solid #2A3545',
                  borderRadius: 20,
                  padding: '1px 8px',
                }}
              >
                MANAGED IN CART RECOVERY
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6B7F95', marginTop: 3 }}>
            {template.description}
          </div>
        </div>
        {!isCartRecovery && (
          <span style={{ color: '#6B7F95', fontSize: 18, flexShrink: 0 }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Edit panel */}
      {open && !isCartRecovery && (
        <div
          style={{
            padding: '0 18px 18px',
            borderTop: '1px solid #1C2D3F',
          }}
        >
          {/* Available placeholders */}
          <div style={{ margin: '14px 0 8px', fontSize: 12, color: '#8B95A3', fontWeight: 600 }}>
            AVAILABLE PLACEHOLDERS
          </div>
          <div style={{ marginBottom: 14 }}>
            {template.available_vars.map((v) => (
              <PlaceholderChip key={v} label={v} />
            ))}
          </div>

          {/* Subject */}
          <label style={{ display: 'block', fontSize: 12, color: '#8B95A3', fontWeight: 600, marginBottom: 6 }}>
            SUBJECT LINE
            <span style={{ fontWeight: 400, color: '#506070', marginLeft: 6 }}>(leave blank = use built-in default)</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Leave blank to use the built-in default subject…"
            style={{
              width: '100%',
              background: '#040D16',
              border: '1px solid #1C2D3F',
              borderRadius: 6,
              padding: '9px 12px',
              color: '#D0DAE4',
              fontSize: 13,
              fontFamily: 'Inter, Arial, sans-serif',
              boxSizing: 'border-box',
              outline: 'none',
              marginBottom: 12,
            }}
          />

          {/* Body */}
          <label style={{ display: 'block', fontSize: 12, color: '#8B95A3', fontWeight: 600, marginBottom: 6 }}>
            MESSAGE BODY
            <span style={{ fontWeight: 400, color: '#506070', marginLeft: 6 }}>(leave blank = use built-in default)</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Write your custom message here. Use placeholders like {name}, {order}, etc.\nEach line becomes a paragraph. Buttons, totals, and the footer are auto-inserted.`}
            rows={5}
            style={{
              width: '100%',
              background: '#040D16',
              border: '1px solid #1C2D3F',
              borderRadius: 6,
              padding: '9px 12px',
              color: '#D0DAE4',
              fontSize: 13,
              fontFamily: 'Inter, Arial, sans-serif',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
              lineHeight: 1.6,
              marginBottom: 14,
            }}
          />

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: '#00C4BC',
                color: '#040D16',
                border: 'none',
                borderRadius: 7,
                padding: '9px 22px',
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Override'}
            </button>
            {hasOverride && (
              <button
                onClick={handleClear}
                disabled={clearing}
                style={{
                  background: 'transparent',
                  color: '#8B95A3',
                  border: '1px solid #2A3D50',
                  borderRadius: 7,
                  padding: '9px 18px',
                  fontSize: 13,
                  cursor: clearing ? 'wait' : 'pointer',
                }}
              >
                {clearing ? 'Clearing…' : 'Clear — Revert To Default'}
              </button>
            )}
            {template.updated_at && (
              <span style={{ fontSize: 11, color: '#506070', marginLeft: 'auto' }}>
                Last saved: {new Date(template.updated_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmailCenterClient() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Blast state
  const [blastSubject, setBlastSubject] = useState('');
  const [blastBody, setBlastBody] = useState('');
  const [blastSegment, setBlastSegment] = useState<'all' | 'with_orders'>('all');
  const [blastSending, setBlastSending] = useState(false);
  const [blastResult, setBlastResult] = useState<BlastResult | null>(null);
  const [blastError, setBlastError] = useState<string | null>(null);

  // Load templates
  useEffect(() => {
    fetch('/api/admin/email-templates')
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load templates');
        setLoading(false);
      });
  }, []);

  const handleSave = useCallback(async (key: string, subject: string, body: string) => {
    const res = await fetch('/api/admin/email-templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_key: key, subject_override: subject, body_override: body }),
    });
    if (res.ok) {
      const { template } = await res.json();
      setTemplates((prev) =>
        prev.map((t) => (t.template_key === key ? { ...t, ...template } : t))
      );
    }
  }, []);

  const handleBlast = async () => {
    if (!blastSubject.trim() || !blastBody.trim()) return;
    setBlastSending(true);
    setBlastResult(null);
    setBlastError(null);
    try {
      const res = await fetch('/api/admin/email-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: blastSubject, body: blastBody, segment: blastSegment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      setBlastResult(data);
      setBlastSubject('');
      setBlastBody('');
    } catch (e) {
      setBlastError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBlastSending(false);
    }
  };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E2EAF0', marginBottom: 4 }}>
        Email Center
      </h1>
      <p style={{ fontSize: 13, color: '#6B7F95', marginBottom: 32 }}>
        All outgoing transactional emails go through Resend using{' '}
        <strong style={{ color: '#D0DAE4' }}>research@pepnationlab.com</strong>.
        Edit any template below — saves take effect on the next send, no deploy needed.
        Clear an override to revert to the built-in default.
      </p>

      {/* ── Blast Composer ── */}
      <section
        style={{
          background: '#07111C',
          border: '1px solid #1C2D3F',
          borderRadius: 12,
          padding: 22,
          marginBottom: 32,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#E2EAF0', marginBottom: 4 }}>
          📣 Broadcast Email
        </h2>
        <p style={{ fontSize: 12, color: '#6B7F95', marginBottom: 18 }}>
          Send a one-off email to all researchers or a filtered segment. This uses your Resend account and goes out immediately.
        </p>

        {/* Segment selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['all', 'with_orders'] as const).map((seg) => (
            <button
              key={seg}
              onClick={() => setBlastSegment(seg)}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: blastSegment === seg ? '#00C4BC' : '#1C2D3F',
                background: blastSegment === seg ? '#00C4BC22' : 'transparent',
                color: blastSegment === seg ? '#00C4BC' : '#8B95A3',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {seg === 'all' ? 'All Researchers' : 'Researchers With Orders'}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={blastSubject}
          onChange={(e) => setBlastSubject(e.target.value)}
          placeholder="Email subject…"
          style={{
            width: '100%',
            background: '#040D16',
            border: '1px solid #1C2D3F',
            borderRadius: 6,
            padding: '9px 12px',
            color: '#D0DAE4',
            fontSize: 13,
            boxSizing: 'border-box',
            outline: 'none',
            marginBottom: 10,
          }}
        />
        <textarea
          value={blastBody}
          onChange={(e) => setBlastBody(e.target.value)}
          placeholder="Message body — plain text, each line becomes a paragraph…"
          rows={5}
          style={{
            width: '100%',
            background: '#040D16',
            border: '1px solid #1C2D3F',
            borderRadius: 6,
            padding: '9px 12px',
            color: '#D0DAE4',
            fontSize: 13,
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleBlast}
            disabled={blastSending || !blastSubject.trim() || !blastBody.trim()}
            style={{
              background: '#00C4BC',
              color: '#040D16',
              border: 'none',
              borderRadius: 7,
              padding: '10px 24px',
              fontSize: 13,
              fontWeight: 700,
              cursor: blastSending ? 'wait' : 'pointer',
              opacity: blastSending || !blastSubject.trim() || !blastBody.trim() ? 0.5 : 1,
            }}
          >
            {blastSending ? 'Sending…' : 'Send Blast'}
          </button>
          {blastResult && (
            <span style={{ fontSize: 13, color: '#00C4BC' }}>
              ✓ Sent {blastResult.sent}/{blastResult.total} ({blastResult.failed} failed)
            </span>
          )}
          {blastError && (
            <span style={{ fontSize: 13, color: '#EF4444' }}>⚠ {blastError}</span>
          )}
        </div>
      </section>

      {/* ── Automated Email Templates ── */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#E2EAF0', marginBottom: 4 }}>
          ✉️ Automated Email Templates
        </h2>
        <p style={{ fontSize: 12, color: '#6B7F95', marginBottom: 18 }}>
          Click any template to edit its subject line and body copy. Placeholders like{' '}
          <code style={{ color: '#00C4BC', fontSize: 11 }}>{'{name}'}</code> are replaced automatically at send time.
          Buttons, order totals, verification codes, and the footer are always auto-inserted — your edits cannot break a transactional email.
        </p>

        {loading && (
          <div style={{ color: '#6B7F95', fontSize: 13, padding: 20 }}>Loading templates…</div>
        )}
        {error && (
          <div style={{ color: '#EF4444', fontSize: 13, padding: 20 }}>{error}</div>
        )}
        {!loading && !error && templates.map((t) => (
          <TemplateCard key={t.template_key} template={t} onSave={handleSave} />
        ))}
      </section>
    </div>
  );
}
