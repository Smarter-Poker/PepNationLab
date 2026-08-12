'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/ui/BackButton';
import Navbar from '@/components/Navbar';
import { getRealEmail } from '@/lib/profile-utils';

/**
 * Promote Researcher → Agent or Super Agent.
 *
 * Backing API: POST /api/agent/promote-subagent
 * { researcherId, markupPct, isSuperAgent, paymentModel, creditLimit? }
 */

type Researcher = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
};

export default function PromoteSubAgentPage() {
  const router = useRouter();

  const [researchers, setResearchers] = useState<Researcher[]>([]);
  const [loadingResearchers, setLoadingResearchers] = useState(true);
  const [researcherListError, setResearcherListError] = useState<string | null>(null);

  const [researcherId, setResearcherId] = useState('');
  const [isSuperAgent, setIsSuperAgent] = useState(false);
  const [markupPct, setMarkupPct] = useState<number>(50);
  const [paymentModel, setPaymentModel] = useState<'credit' | 'prepaid'>('credit');
  const [creditLimit, setCreditLimit] = useState<number>(1000);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingResearchers(true);
      try {
        const res = await fetch('/api/agent/researchers', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list: Researcher[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (!cancelled) setResearchers(list);
      } catch {
        if (!cancelled) {
          setResearcherListError('Could Not Load Researcher List. You Can Still Paste A Researcher ID Manually Below.');
        }
      } finally {
        if (!cancelled) setLoadingResearchers(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function clampMarkup(v: number): number {
    if (!Number.isFinite(v)) return 10;
    if (v < 10) return 10;
    if (v > 200) return 200;
    return v;
  }

  async function copyShareLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMsg(null);
    setShareLink(null);
    setCopied(false);

    if (!researcherId.trim()) {
      setSubmitError('Please select or paste a Researcher ID.');
      return;
    }
    const pct = clampMarkup(Number(markupPct));
    if (pct !== markupPct) setMarkupPct(pct);

    if (paymentModel === 'credit') {
      if (!Number.isFinite(Number(creditLimit)) || Number(creditLimit) < 0) {
        setSubmitError('Credit Limit Must Be A Non-Negative Number.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/agent/promote-subagent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          researcherId: researcherId.trim(),
          markupPct: pct,
          isSuperAgent,
          paymentModel,
          creditLimit: paymentModel === 'credit' ? Number(creditLimit) : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setSuccessMsg(
        json?.message ||
          `Researcher promoted successfully at ${pct}% markup on a ${
            paymentModel === 'credit' ? `$${creditLimit} credit line` : 'prepaid account'
          }.`,
      );

      if (json?.share_link && typeof json.share_link === 'string') {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setShareLink(`${origin}${json.share_link}`);
      } else if (json?.parent_slug && json?.sub_agent_id) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setShareLink(`${origin}/${json.parent_slug}?sa=${json.sub_agent_id}`);
      }

      const promotedId = researcherId.trim();
      setResearchers((prev) => prev.filter((r) => r.id !== promotedId));
      setResearcherId('');
      setMarkupPct(50);
      setIsSuperAgent(false);
      setPaymentModel('credit');
      setCreditLimit(1000);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Promotion Failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedResearcher = researchers.find((r) => r.id === researcherId);

  return (
    <>
      <Navbar />
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', paddingTop: 'calc(var(--nav-offset, 60px) + 24px)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}><BackButton label="Back To Sub-Agents" /></div>
        <h1 style={{ fontSize: '28px', marginBottom: '8px', color: 'var(--white)' }}>Promote A Researcher</h1>
        <p style={{ marginBottom: '28px', opacity: 0.75, lineHeight: 1.6, fontSize: '0.93rem' }}>
          Select a researcher from your downline and promote them to an Agent or Super Agent.
          Set their markup percentage — this is the margin they earn on top of your base cost,
          not a commission on gross sales. The researcher buys from you at your base cost,
          sells at base cost × (1 + markup%), and keeps the difference.
        </p>

        {/* Share link card */}
        {shareLink && (
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', border: '1px solid #10B981' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', color: '#10B981', fontWeight: 700 }}>
              New Agent's Invite Link
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="text" readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} className="form-input" style={{ flex: 1, padding: '8px 10px', fontSize: '14px', fontFamily: 'monospace' }} />
              <button type="button" onClick={copyShareLink} className="btn-secondary" style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                {copied ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
              Share this link with the newly promoted agent to get them started.
            </div>
          </div>
        )}

        {/* Researcher selector */}
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--white)' }}>1. Select A Researcher</h2>
          {loadingResearchers ? (
            <div style={{ opacity: 0.7 }}>Loading your researchers...</div>
          ) : researcherListError ? (
            <div style={{ color: '#E53E3E', marginBottom: '8px' }}>{researcherListError}</div>
          ) : researchers.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No researchers in your downline yet. Researchers sign up through your storefront.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
              {researchers.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setResearcherId(r.id)}
                  className={researcherId === r.id ? 'btn-primary' : 'btn-secondary'}
                  style={{ textAlign: 'left', padding: '10px 12px' }}
                >
                  <div style={{ fontWeight: 600 }}>{r.full_name || r.username || 'Unnamed Researcher'}</div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>{(getRealEmail(r) || '') || r.id.slice(0, 8)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Promotion form */}
        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--white)' }}>2. Configure Promotion</h2>

          {/* Researcher ID field */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem' }}>Researcher ID</label>
            <input
              type="text"
              value={researcherId}
              onChange={(e) => setResearcherId(e.target.value)}
              placeholder="Click a researcher above or paste their ID"
              className="form-input"
              style={{ width: '100%', padding: '8px 10px', fontSize: '15px' }}
              required
            />
            {selectedResearcher && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--teal)' }}>
                ✓ {selectedResearcher.full_name || selectedResearcher.username}
              </div>
            )}
          </div>

          {/* Role selector */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>Role To Assign</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setIsSuperAgent(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  border: `2px solid ${!isSuperAgent ? 'var(--teal)' : 'rgba(255,255,255,0.1)'}`,
                  background: !isSuperAgent ? 'rgba(0,196,188,0.12)' : 'rgba(255,255,255,0.03)',
                  color: 'var(--white)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>Agent</div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Sells on their own storefront under your network. Sets their own prices within their markup.</div>
              </button>
              <button
                type="button"
                onClick={() => setIsSuperAgent(true)}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  border: `2px solid ${isSuperAgent ? 'var(--teal)' : 'rgba(255,255,255,0.1)'}`,
                  background: isSuperAgent ? 'rgba(0,196,188,0.12)' : 'rgba(255,255,255,0.03)',
                  color: 'var(--white)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>Super Agent</div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Full agent with the ability to recruit and manage their own downline of agents.</div>
              </button>
            </div>
          </div>

          {/* Markup slider */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
              Markup On Base Cost: <span style={{ color: 'var(--teal)', fontWeight: 800 }}>{markupPct}%</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min={10}
                max={200}
                step={5}
                value={markupPct}
                onChange={(e) => setMarkupPct(clampMarkup(Number(e.target.value)))}
                style={{ flex: 1, accentColor: 'var(--teal)' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min={10}
                  max={200}
                  step={5}
                  value={markupPct}
                  onChange={(e) => setMarkupPct(clampMarkup(Number(e.target.value)))}
                  className="form-input"
                  style={{ width: '80px', padding: '6px 8px', fontSize: '15px', textAlign: 'center' }}
                />
                <span style={{ opacity: 0.6, fontWeight: 600 }}>%</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>
              <span>10% (min)</span>
              <span style={{ fontSize: '12px', opacity: 0.65 }}>
                Agent buys at base cost, sells at <strong style={{ color: 'var(--teal)' }}>{markupPct}%</strong> above it
              </span>
              <span>200% (max)</span>
            </div>
          </div>

          {/* Payment model */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>Payment Model</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['credit', 'prepaid'] as const).map((model) => (
                <label
                  key={model}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '10px',
                    border: `2px solid ${paymentModel === model ? 'var(--teal)' : 'rgba(255,255,255,0.1)'}`,
                    background: paymentModel === model ? 'rgba(0,196,188,0.08)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input type="radio" name="paymentModel" value={model} checked={paymentModel === model} onChange={() => setPaymentModel(model)} style={{ accentColor: 'var(--teal)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{model === 'credit' ? 'Credit Line' : 'Prepaid'}</div>
                    <div style={{ fontSize: '11px', opacity: 0.6 }}>
                      {model === 'credit' ? 'Agent orders up to a credit cap before needing to pay' : 'Agent pre-loads a balance before ordering'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Credit limit */}
          {paymentModel === 'credit' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                Credit Cap (USD)
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={creditLimit}
                onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="form-input"
                style={{ width: '200px', padding: '8px 10px', fontSize: '16px' }}
              />
              <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '4px' }}>
                Maximum unpaid balance allowed before the agent is blocked at checkout.
              </div>
            </div>
          )}

          {submitError && <div style={{ color: '#E53E3E', fontWeight: 600, padding: '10px 14px', background: 'rgba(229,62,62,0.1)', borderRadius: '8px', border: '1px solid rgba(229,62,62,0.3)' }}>{submitError}</div>}
          {successMsg && <div style={{ color: '#10B981', fontWeight: 600, padding: '10px 14px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)' }}>✓ {successMsg}</div>}

          <button
            type="submit"
            disabled={submitting || !researcherId.trim()}
            className="btn-primary"
            style={{ padding: '12px 24px', fontSize: '16px', alignSelf: 'flex-start' }}
          >
            {submitting ? 'Promoting...' : `Promote To ${isSuperAgent ? 'Super Agent' : 'Agent'}`}
          </button>
        </form>
      </div>
    </>
  );
}
