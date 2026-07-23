'use client';

/**
 * AgentShippingAccountCard - EasyPost Forge white-label shipping account.
 *
 * Rendered in the agent dashboard (Storefront Config tab). Hidden entirely
 * while the admin Forge toggle is off (GET /api/agent/shipping/account
 * returns available:false).
 *
 * State machine:
 *   Not Provisioned -> "Set Up Shipping Account" (POST /account)
 *   Pending Card    -> Stripe.js card form. Stripe.js v3 loads at runtime
 *                      from https://js.stripe.com/v3/ (no npm dependency),
 *                      initialized with EasyPost's Stripe publishable key
 *                      from GET /account/stripe-key. The card tokenizes in
 *                      the browser; only the payment method id is POSTed to
 *                      /account/card. Raw card data never touches our API.
 *   Active          -> Card brand/last4 + wallet note.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, PackageCheck, Ship, AlertTriangle } from 'lucide-react';

interface AccountStatus {
  available: boolean;
  provisioned: boolean;
  billingStatus: 'pending_card' | 'active' | 'disabled' | null;
  cardBrand: string | null;
  cardLast4: string | null;
  keyLast4: string | null;
}

// Minimal runtime typings for the Stripe.js objects we touch.
interface StripeCardElement {
  mount: (selectorOrElement: string | HTMLElement) => void;
  unmount: () => void;
  on: (event: string, handler: (ev: { error?: { message?: string }; complete?: boolean }) => void) => void;
}
interface StripeElements {
  create: (type: 'card', options?: Record<string, unknown>) => StripeCardElement;
}
interface StripeInstance {
  elements: () => StripeElements;
  createPaymentMethod: (options: {
    type: 'card';
    card: StripeCardElement;
  }) => Promise<{ paymentMethod?: { id: string }; error?: { message?: string } }>;
}
declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance;
  }
}

const STRIPE_JS_SRC = 'https://js.stripe.com/v3/';

function loadStripeJs(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Stripe.js Can Only Load In The Browser.'));
      return;
    }
    if (window.Stripe) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${STRIPE_JS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed To Load The Card Form. Please Refresh And Try Again.')));
      if (window.Stripe) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = STRIPE_JS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed To Load The Card Form. Please Refresh And Try Again.'));
    document.head.appendChild(script);
  });
}

export default function AgentShippingAccountCard() {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const cardMountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<StripeInstance | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/shipping/account');
      if (!res.ok) return;
      const data = (await res.json()) as AccountStatus;
      setStatus(data);
    } catch {
      /* leave hidden on failure */
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Mount the Stripe card element while a card is pending.
  useEffect(() => {
    if (!status?.available || !status.provisioned || status.billingStatus !== 'pending_card') return;
    let cancelled = false;

    (async () => {
      try {
        const keyRes = await fetch('/api/agent/shipping/account/stripe-key');
        const keyJson = await keyRes.json().catch(() => ({} as { publishableKey?: string; error?: string }));
        if (!keyRes.ok || !keyJson.publishableKey) {
          throw new Error(keyJson.error || 'Card Setup Is Temporarily Unavailable.');
        }
        await loadStripeJs();
        if (cancelled || !window.Stripe || !cardMountRef.current) return;

        const stripe = window.Stripe(keyJson.publishableKey);
        const elements = stripe.elements();
        const card = elements.create('card', {
          style: {
            base: {
              color: '#FFFFFF',
              fontFamily: 'Inter, sans-serif',
              fontSize: '15px',
              '::placeholder': { color: '#A8B4C0' },
            },
            invalid: { color: '#E53E3E' },
          },
        });
        card.mount(cardMountRef.current);
        card.on('change', (ev) => {
          setErrorMsg(ev.error?.message || '');
          setCardComplete(!!ev.complete);
        });
        stripeRef.current = stripe;
        cardElementRef.current = card;
        setCardReady(true);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Card Setup Is Temporarily Unavailable.');
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        cardElementRef.current?.unmount();
      } catch { /* already unmounted */ }
      cardElementRef.current = null;
      stripeRef.current = null;
      setCardReady(false);
      setCardComplete(false);
    };
  }, [status?.available, status?.provisioned, status?.billingStatus]);

  async function handleProvision() {
    setProvisioning(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/agent/shipping/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error(data.error || 'Failed To Create Your Shipping Account.');
      toast.success('Shipping Account Created. Add Your Card To Start Buying Labels.');
      await fetchStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Create Your Shipping Account.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setProvisioning(false);
    }
  }

  async function handleSaveCard(e: React.FormEvent) {
    e.preventDefault();
    if (!stripeRef.current || !cardElementRef.current) return;
    setCardSaving(true);
    setErrorMsg('');
    try {
      const pmResult = await stripeRef.current.createPaymentMethod({
        type: 'card',
        card: cardElementRef.current,
      });
      if (pmResult.error || !pmResult.paymentMethod?.id) {
        throw new Error(pmResult.error?.message || 'Card Was Declined. Check The Details And Try Again.');
      }

      const res = await fetch('/api/agent/shipping/account/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodReference: pmResult.paymentMethod.id }),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error(data.error || 'Failed To Save Your Card.');

      toast.success('Card Added. Your Shipping Account Is Active.');
      await fetchStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Save Your Card.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setCardSaving(false);
    }
  }

  // Hidden entirely until the admin enables Forge.
  if (!status?.available) return null;

  return (
    <div className="glass-panel" style={{ marginTop: 'var(--space-6)', padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3)' }}>
        <Ship size={20} color="var(--teal)" />
        <h3 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
          Shipping Account
        </h3>
        {status.billingStatus === 'active' && (
          <span style={{
            background: 'rgba(0,196,188,0.12)',
            color: 'var(--teal)',
            border: '1px solid rgba(0,196,188,0.3)',
            borderRadius: 999,
            padding: '2px 10px',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Active
          </span>
        )}
      </div>

      {errorMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          background: 'rgba(229,62,62,0.08)',
          border: '1px solid rgba(229,62,62,0.35)',
          borderRadius: 10,
          padding: '10px 14px',
          marginBottom: 'var(--space-4)',
          color: '#FC8181',
          fontSize: '0.85rem',
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {!status.provisioned && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ color: 'var(--silver)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
            Buy And Print Discounted USPS, UPS, FedEx, And DHL Labels Right From Your Orders
            Tab - No Copy And Paste. Set Up Your Own Shipping Account Once, Add Your Card,
            And Every Label Is Billed To You By EasyPost, Never By PepNationLab.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleProvision}
            disabled={provisioning}
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
          >
            <PackageCheck size={16} />
            {provisioning ? 'Setting Up...' : 'Set Up Shipping Account'}
          </button>
        </div>
      )}

      {status.provisioned && status.billingStatus === 'pending_card' && (
        <form onSubmit={handleSaveCard} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ color: 'var(--silver)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
            Your Shipping Account Is Ready. Add A Card To Activate Label Buying. Your Card Is
            Stored And Billed Securely By EasyPost - PepNationLab Never Sees Or Charges It.
          </p>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--silver)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 8 }}>
              <CreditCard size={14} />
              Card Details
            </label>
            <div
              ref={cardMountRef}
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: '14px 16px',
                minHeight: 48,
              }}
            />
            {!cardReady && (
              <div style={{ color: 'var(--grey-400)', fontSize: '0.8rem', marginTop: 6 }}>
                Loading Secure Card Form...
              </div>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!cardReady || !cardComplete || cardSaving}
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
          >
            {cardSaving ? 'Saving Card...' : 'Save Card'}
          </button>
        </form>
      )}

      {status.provisioned && status.billingStatus === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--white)', fontSize: '0.95rem', fontWeight: 600 }}>
            <PackageCheck size={18} color="var(--teal)" />
            Shipping Account Active
          </div>
          {(status.cardBrand || status.cardLast4) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--silver)', fontSize: '0.88rem' }}>
              <CreditCard size={15} />
              <span style={{ textTransform: 'capitalize' }}>{status.cardBrand || 'Card'}</span>
              {status.cardLast4 && (
                <span style={{ fontFamily: 'monospace', color: 'var(--white)' }}>
                  **** {status.cardLast4}
                </span>
              )}
            </div>
          )}
          <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>
            Labels Are Paid From Your EasyPost Wallet. Buy Them With One Click From The Ship It
            Panel On Any Approved Order.
          </p>
        </div>
      )}

      {status.provisioned && status.billingStatus === 'disabled' && (
        <p style={{ color: 'var(--silver)', fontSize: '0.9rem', margin: 0 }}>
          Your Shipping Account Is Currently Disabled. Contact Support To Reactivate It.
        </p>
      )}
    </div>
  );
}
