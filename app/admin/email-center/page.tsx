'use client';

import { useCallback, useEffect, useState } from 'react';

interface Audience { key: string; label: string; count: number }
interface Blast {
  id: string;
  subject: string;
  audience: string;
  include_promo: boolean;
  sent_count: number;
  skipped_count: number;
  created_at: string;
}
interface TemplateRow {
  key: string;
  label: string;
  description: string;
  vars: string[];
  defaultSubject: string;
  defaultBody: string;
  subject: string | null;
  body: string | null;
  updated_at: string | null;
}

/**
 * Admin Email Center: compose and send an email to a customer audience
 * (house-store customers, all researchers, never-ordered, agents), with an
 * optional FIRST20 promo block, a test-send to yourself, and blast history.
 * Automated emails (welcome, first-order nudge, cart recovery, order status)
 * keep running on their own -- this page is for ad-hoc announcements.
 */
export default function EmailCenterPage() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [history, setHistory] = useState<Blast[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  const [audience, setAudience] = useState('researchers_house');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includePromo, setIncludePromo] = useState(true);
  const [busy, setBusy] = useState<'test' | 'send' | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [tplBusy, setTplBusy] = useState(false);
  const [tplNotice, setTplNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [blastRes, tplRes] = await Promise.all([
        fetch('/api/admin/email-blast'),
        fetch('/api/admin/email-templates'),
      ]);
      const json = await blastRes.json();
      if (blastRes.ok) {
        setAudiences(json.audiences ?? []);
        setHistory(json.history ?? []);
        setConfigured(json.configured !== false);
      }
      const tplJson = await tplRes.json();
      if (tplRes.ok) setTemplates(tplJson.templates ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  function openTemplate(t: TemplateRow) {
    setOpenKey(t.key === openKey ? null : t.key);
    setTplSubject(t.subject ?? '');
    setTplBody(t.body ?? '');
    setTplNotice(null);
  }

  async function saveTemplate(key: string, reset: boolean) {
    setTplBusy(true);
    setTplNotice(null);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reset ? { key, subject: '', body: '' } : { key, subject: tplSubject, body: tplBody }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTplNotice(json.error || 'Save Failed.');
      } else {
        setTplNotice(reset ? 'Template Reset To The Built-In Default.' : 'Template Saved. New Sends Use This Copy Within A Minute.');
        if (reset) { setTplSubject(''); setTplBody(''); }
        void load();
      }
    } catch {
      setTplNotice('Network Error. Please Try Again.');
    } finally {
      setTplBusy(false);
    }
  }

  useEffect(() => { void load(); }, [load]);

  const selected = audiences.find((a) => a.key === audience);
  const audienceLabel = (key: string) => audiences.find((a) => a.key === key)?.label ?? key;

  async function submit(mode: 'test' | 'send') {
    setNotice(null);
    if (!subject.trim() || !body.trim()) {
      setNotice({ kind: 'err', text: 'Subject And Message Are Both Required.' });
      return;
    }
    setBusy(mode);
    try {
      const res = await fetch('/api/admin/email-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, audience, subject, body, includePromo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'err', text: json.error || 'Send Failed.' });
      } else if (mode === 'test') {
        setNotice({ kind: 'ok', text: `Test Email Sent To ${json.to}. Check Your Inbox Before Sending The Blast.` });
      } else {
        setNotice({ kind: 'ok', text: `Blast Sent: ${json.sent} Delivered, ${json.skipped} Skipped.` });
        setConfirming(false);
        setSubject('');
        setBody('');
        void load();
      }
    } catch {
      setNotice({ kind: 'err', text: 'Network Error. Please Try Again.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ fontSize: '1.3rem', color: 'var(--white)', marginBottom: 4 }}>Email Center</h1>
      <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
        Compose And Send An Email To Your Customers. Automated Emails (Welcome + FIRST20, First-Order Nudge,
        Cart Recovery, Order Updates) Run On Their Own &mdash; This Page Is For One-Off Announcements.
        Use <code style={{ color: 'var(--white)' }}>{'{name}'}</code> To Insert The Recipient&apos;s First Name.
      </p>

      {!configured && (
        <p style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: 'var(--space-3)' }}>
          Email Sending Is Not Configured On The Server (RESEND_API_KEY Missing).
        </p>
      )}

      <div className="card-glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)' }}>
        <label className="form-label">Audience</label>
        <select className="form-input" value={audience} onChange={(e) => { setAudience(e.target.value); setConfirming(false); }} style={{ marginBottom: 'var(--space-3)' }}>
          {audiences.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}{a.count >= 0 ? ` (${a.count} Mailable)` : ''}
            </option>
          ))}
        </select>

        <label className="form-label">Subject</label>
        <input type="text" className="form-input" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. New Compounds Just Landed" style={{ marginBottom: 'var(--space-3)' }} />

        <label className="form-label">Message</label>
        <textarea className="form-input" rows={8} value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} placeholder={'Hi {name},\n\nWrite your announcement here. Blank lines start new paragraphs.'} style={{ marginBottom: 'var(--space-3)', resize: 'vertical' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--grey-300)', marginBottom: 'var(--space-4)', cursor: 'pointer' }}>
          <input type="checkbox" checked={includePromo} onChange={(e) => setIncludePromo(e.target.checked)} />
          Include The FIRST20 Promo Block (20% Off First Order)
        </label>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn-neon-cyan" disabled={busy !== null} onClick={() => submit('test')} style={{ whiteSpace: 'nowrap' }}>
            {busy === 'test' ? 'Sending Test...' : 'Send Test To Me'}
          </button>
          {!confirming ? (
            <button type="button" className="btn-neon-cyan" disabled={busy !== null || !configured} onClick={() => setConfirming(true)} style={{ whiteSpace: 'nowrap' }}>
              Send To {selected ? `${Math.max(selected.count, 0)} Recipient${selected.count === 1 ? '' : 's'}` : 'Audience'}
            </button>
          ) : (
            <>
              <span style={{ fontSize: '0.8rem', color: 'var(--grey-300)' }}>
                Send &quot;{subject || '(No Subject)'}&quot; To {selected?.count ?? 0} People?
              </span>
              <button type="button" className="btn-neon-cyan" disabled={busy !== null} onClick={() => submit('send')} style={{ whiteSpace: 'nowrap' }}>
                {busy === 'send' ? 'Sending...' : 'Yes, Send It'}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy !== null} style={{ background: 'none', border: '1px solid var(--grey-600)', color: 'var(--grey-300)', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Cancel
              </button>
            </>
          )}
        </div>

        {notice && (
          <p role="alert" style={{ marginTop: 'var(--space-3)', fontSize: '0.82rem', color: notice.kind === 'ok' ? '#2DD4BF' : 'var(--red)' }}>
            {notice.text}
          </p>
        )}
      </div>

      <h2 style={{ fontSize: '1rem', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>Automated Email Templates</h2>
      <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-3)' }}>
        Every Email The Platform Sends Automatically (Via Your Resend Account). Edit The Subject Or Message
        And New Sends Use Your Copy; Clear Both To Restore The Built-In Default. Buttons, Order Totals,
        Verification Codes, And Promo Blocks Are Added Automatically And Cannot Break.
        Abandoned-Cart Copy Is Edited In Admin &rarr; Cart Recovery.
      </p>
      <div className="card-glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
        {templates.map((t) => (
          <div key={t.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={() => openTemplate(t)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-3) var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--white)', fontSize: '0.86rem' }}>{t.label}</strong>
                <span style={{ fontSize: '0.74rem', color: (t.subject || t.body) ? '#2DD4BF' : 'var(--grey-400)' }}>
                  {(t.subject || t.body) ? 'Customized' : 'Default'} {openKey === t.key ? '▴' : '▾'}
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--grey-400)', marginTop: 2 }}>{t.description}</div>
            </button>
            {openKey === t.key && (
              <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                {t.vars.length > 0 && (
                  <p style={{ fontSize: '0.74rem', color: 'var(--grey-400)', margin: '0 0 8px' }}>
                    Placeholders: {t.vars.map((v) => <code key={v} style={{ color: 'var(--white)', marginRight: 6 }}>{v}</code>)}
                  </p>
                )}
                <label className="form-label">Subject (Default: {t.defaultSubject})</label>
                <input type="text" className="form-input" value={tplSubject} maxLength={200} placeholder={t.defaultSubject} onChange={(e) => setTplSubject(e.target.value)} style={{ marginBottom: 'var(--space-2)' }} />
                <label className="form-label">Message (Default: {t.defaultBody})</label>
                <textarea className="form-input" rows={4} value={tplBody} maxLength={4000} placeholder={t.defaultBody} onChange={(e) => setTplBody(e.target.value)} style={{ marginBottom: 'var(--space-2)', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-neon-cyan" disabled={tplBusy} onClick={() => saveTemplate(t.key, false)} style={{ whiteSpace: 'nowrap' }}>
                    {tplBusy ? 'Saving...' : 'Save Template'}
                  </button>
                  <button type="button" disabled={tplBusy} onClick={() => saveTemplate(t.key, true)} style={{ background: 'none', border: '1px solid var(--grey-600)', color: 'var(--grey-300)', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Reset To Default
                  </button>
                </div>
                {tplNotice && <p role="alert" style={{ marginTop: 'var(--space-2)', fontSize: '0.78rem', color: tplNotice.includes('Saved') || tplNotice.includes('Reset') ? '#2DD4BF' : 'var(--red)' }}>{tplNotice}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1rem', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>Recent Blasts</h2>
      {loading ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Loading...</p>
      ) : history.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>No Blasts Sent Yet.</p>
      ) : (
        <div className="card-glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {history.map((b) => (
            <div key={b.id} style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--white)', fontSize: '0.86rem' }}>{b.subject}</strong>
                <span style={{ fontSize: '0.76rem', color: 'var(--grey-400)' }}>{new Date(b.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--grey-400)', marginTop: 2 }}>
                {audienceLabel(b.audience)} &middot; {b.sent_count} Sent{b.skipped_count ? ` · ${b.skipped_count} Skipped` : ''}{b.include_promo ? ' · FIRST20 Included' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
