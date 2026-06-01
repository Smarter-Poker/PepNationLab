'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Minimal SACA Phase 2.5 promote-sub-agent UI.
 *
 * Mounts the form at /dashboard/agent/sub-agents/promote. Backing API:
 *   POST /api/agent/promote-subagent
 *   { researcherId, commissionPct, paymentModel, creditLimit? }
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
  const [commissionPct, setCommissionPct] = useState<number>(20);
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
      } catch (err) {
        if (!cancelled) {
          setResearcherListError(
            'Could Not Load Researcher List. You Can Still Paste A Researcher Id Manually Below.',
          );
        }
      } finally {
        if (!cancelled) setLoadingResearchers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function clampCommission(v: number): number {
    if (!Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 40) return 40;
    return v;
  }

  async function copyShareLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard write blocked; user can copy manually */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMsg(null);
    setShareLink(null);
    setCopied(false);

    if (!researcherId.trim()) {
      setSubmitError('Researcher Id Is Required.');
      return;
    }
    const pct = clampCommission(Number(commissionPct));
    if (pct !== commissionPct) setCommissionPct(pct);

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
          commissionPct: pct,
          paymentModel,
          creditLimit: paymentModel === 'credit' ? Number(creditLimit) : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setSuccessMsg(
        json?.message ||
          `Researcher Promoted Successfully At ${pct}% Commission On A ${paymentModel === 'credit' ? `$${creditLimit}` : 'Prepaid'} ${paymentModel === 'credit' ? 'Credit Line' : 'Account'}.`,
      );

      // Build the absolute share URL the parent will give to the new sub-agent.
      // The server returns parent_slug + sub_agent_id; we prefix the current
      // origin so the link works when copied into a chat / SMS / email.
      if (json?.share_link && typeof json.share_link === 'string') {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setShareLink(`${origin}${json.share_link}`);
      } else if (json?.parent_slug && json?.sub_agent_id) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setShareLink(`${origin}/${json.parent_slug}?sa=${json.sub_agent_id}`);
      }

      // Remove the just-promoted researcher from the candidate list so they
      // can't be promoted again accidentally.
      const promotedId = researcherId.trim();
      setResearchers((prev) => prev.filter((r) => r.id !== promotedId));

      // Reset form for the next promotion
      setResearcherId('');
      setCommissionPct(20);
      setPaymentModel('credit');
      setCreditLimit(1000);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Promotion Failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Promote A Researcher To Sub-Agent</h1>
      <p style={{ marginBottom: '24px', opacity: 0.85, lineHeight: 1.6 }}>
        Sub-Agents Sell On Your Storefront At Your Prices And Earn A Commission Percentage Of Total
        Sales. You Set The Commission Rate (Up To 40%), Decide Whether They Run On A Credit Line Or
        Prepaid Balance, And Cap Their Credit. Commission Accrues On Every Order And Settles To
        Their Account As Digital Credits Every Sunday Night.
      </p>

      {/* Share link card — shown only after a successful promotion */}
      {shareLink && (
        <div className="card-glass" style={{ padding: '16px', marginBottom: '20px', border: '1px solid #10B981' }}>
          <div style={{ fontSize: '12px', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', color: '#10B981' }}>
            Your Sub-Agent&apos;s Invite Link
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={shareLink}
              onFocus={(e) => e.currentTarget.select()}
              style={{ flex: 1, padding: '8px 10px', fontSize: '13px', fontFamily: 'monospace' }}
            />
            <button type="button" onClick={copyShareLink} className="btn-secondary" style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
          <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '8px' }}>
            Give This Link To Your Sub-Agent. Any New Researcher Who Signs Up Through It Gets Tagged To Them, And Every Order That Researcher Places Earns The Sub-Agent A Commission.
          </div>
        </div>
      )}

      <div className="card-glass" style={{ padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Select A Researcher</h2>
        {loadingResearchers ? (
          <div>Loading Your Researchers...</div>
        ) : researcherListError ? (
          <div style={{ color: '#E53E3E', marginBottom: '8px' }}>{researcherListError}</div>
        ) : researchers.length === 0 ? (
          <div style={{ opacity: 0.8 }}>
            You Have No Researchers In Your Downline Yet. Add Researchers Via Your Storefront Before
            Promoting.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
            {researchers.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setResearcherId(r.id)}
                className={researcherId === r.id ? 'btn-primary' : 'btn-secondary'}
                style={{ textAlign: 'left', padding: '10px 12px' }}
              >
                <div style={{ fontWeight: 600 }}>{r.full_name || r.username || 'Unnamed Researcher'}</div>
                <div style={{ fontSize: '12px', opacity: 0.75 }}>{r.email || r.id.slice(0, 8)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="card-glass" style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Researcher Id</label>
          <input
            type="text"
            value={researcherId}
            onChange={(e) => setResearcherId(e.target.value)}
            placeholder="Paste Or Click A Researcher Above"
            style={{ width: '100%', padding: '8px 10px', fontSize: '14px' }}
            required
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
            Commission Percentage (% Of Total Sales): {commissionPct}%
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range"
              min={0}
              max={40}
              step={0.5}
              value={commissionPct}
              onChange={(e) => setCommissionPct(clampCommission(Number(e.target.value)))}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={0}
              max={40}
              step={0.5}
              value={commissionPct}
              onChange={(e) => setCommissionPct(clampCommission(Number(e.target.value)))}
              style={{ width: '80px', padding: '4px 8px' }}
            />
          </div>
          <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px' }}>
            Capped At 40%. Applied To Gross Peptide Subtotal (Pre-Discount, No Shipping, NOT Profit).
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Payment Model</label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="paymentModel"
                value="credit"
                checked={paymentModel === 'credit'}
                onChange={() => setPaymentModel('credit')}
              />
              Credit Line
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="paymentModel"
                value="prepaid"
                checked={paymentModel === 'prepaid'}
                onChange={() => setPaymentModel('prepaid')}
              />
              Prepaid
            </label>
          </div>
          <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px' }}>
            Credit Lines Are Virtual Caps. Your Own Admin-Assigned Credit Is The Real Ceiling.
          </div>
        </div>

        {paymentModel === 'credit' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              Virtual Credit Cap (Dollars)
            </label>
            <input
              type="number"
              min={0}
              step={50}
              value={creditLimit}
              onChange={(e) => setCreditLimit(Number(e.target.value))}
              style={{ width: '200px', padding: '8px 10px', fontSize: '14px' }}
            />
            <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px' }}>
              How Much Of Their Sales Can Sit Unpaid To You Before They&apos;re Blocked At Checkout.
            </div>
          </div>
        )}

        {submitError && (
          <div style={{ color: '#E53E3E', marginBottom: '12px', fontWeight: 600 }}>{submitError}</div>
        )}
        {successMsg && (
          <div style={{ color: '#10B981', marginBottom: '12px', fontWeight: 600 }}>{successMsg}</div>
        )}

        <button
          type="submit"
          disabled={submitting || !researcherId.trim()}
          className="btn-primary"
          style={{ padding: '10px 20px', fontSize: '16px' }}
        >
          {submitting ? 'Promoting...' : 'Promote To Sub-Agent'}
        </button>
      </form>
    </div>
  );
}
