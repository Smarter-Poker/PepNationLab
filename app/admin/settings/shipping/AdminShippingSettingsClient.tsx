'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Wifi,
  WifiOff,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Shield,
  Package,
  DollarSign,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShippoStatus {
  connected: boolean;
  mode: 'test' | 'live' | null;
  last4: string | null;
  last_validated_at: string | null;
  last_validation_error: string | null;
  webhook_configured: boolean;
  connected_at: string | null;
  credentials_id?: string;
}

interface ShippingOrigin {
  id: string;
  label: string;
  name: string;
  company: string | null;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
  is_default: boolean;
  is_active: boolean;
  shippo_address_id: string | null;
  created_at: string;
  assigned_agents?: Array<{ id: string; display_name: string; slug: string }>;
}

interface AgentWarehouse {
  id: string;
  display_name: string;
  slug: string;
  warehouse_origin_id: string | null;
  warehouse_origin: { label: string; name: string; city: string; state: string } | null;
  uses_legacy_warehouse: boolean;
  uses_platform_default: boolean;
}

interface OriginFormData {
  label: string;
  name: string;
  company: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
  is_default: boolean;
}

const EMPTY_ORIGIN: OriginFormData = {
  label: '',
  name: '',
  company: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
  phone: '',
  email: '',
  is_default: false,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminShippingSettingsClient() {
  const [status, setStatus] = useState<ShippoStatus | null>(null);
  const [origins, setOrigins] = useState<ShippingOrigin[]>([]);
  const [agentWarehouses, setAgentWarehouses] = useState<AgentWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [agentAssignLoading, setAgentAssignLoading] = useState<string | null>(null);

  // Connect form state
  const [connectKey, setConnectKey] = useState('');
  const [connectMode, setConnectMode] = useState<'test' | 'live'>('test');
  const [connectWebhook, setConnectWebhook] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);

  // Rotate form state
  const [rotateKey, setRotateKey] = useState('');
  const [rotateWebhook, setRotateWebhook] = useState('');
  const [rotateLoading, setRotateLoading] = useState(false);
  const [showRotate, setShowRotate] = useState(false);

  // Origin form state
  const [showOriginForm, setShowOriginForm] = useState(false);
  const [editingOrigin, setEditingOrigin] = useState<string | null>(null);
  const [originForm, setOriginForm] = useState<OriginFormData>(EMPTY_ORIGIN);
  const [originLoading, setOriginLoading] = useState(false);

  // Test address state
  const [testAddr, setTestAddr] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/shippo/status');
      if (r.ok) setStatus(await r.json());
    } catch {
      /* no-op */
    }
  }, []);

  const fetchOrigins = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/shipping-origins');
      if (r.ok) {
        const d = await r.json();
        setOrigins(d.origins ?? []);
      }
    } catch {
      /* no-op */
    }
  }, []);

  const fetchAgentWarehouses = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/agents/warehouse-origins');
      if (r.ok) {
        const d = await r.json();
        setAgentWarehouses(d.agents ?? []);
      }
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([fetchStatus(), fetchOrigins(), fetchAgentWarehouses()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchStatus, fetchOrigins, fetchAgentWarehouses]);

  // ---------------------------------------------------------------------------
  // Connect / Disconnect / Rotate
  // ---------------------------------------------------------------------------

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!connectKey.trim()) return;
    setConnectLoading(true);
    try {
      const r = await fetch('/api/admin/shippo/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: connectKey, mode: connectMode, webhook_secret: connectWebhook || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Connect Failed');
      showToast('Shippo Connected Successfully.', 'ok');
      setConnectKey('');
      setConnectWebhook('');
      await fetchStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Connect Failed.', 'err');
    } finally {
      setConnectLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Shippo? All New Label Purchases Will Fail Until Reconnected.')) return;
    try {
      const r = await fetch('/api/admin/shippo/disconnect', { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Disconnect Failed');
      showToast('Shippo Disconnected.', 'ok');
      await fetchStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Disconnect Failed.', 'err');
    }
  }

  async function handleRotate(e: React.FormEvent) {
    e.preventDefault();
    if (!rotateKey.trim()) return;
    setRotateLoading(true);
    try {
      const r = await fetch('/api/admin/shippo/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: rotateKey, webhook_secret: rotateWebhook || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Rotate Failed');
      showToast('API Key Rotated Successfully.', 'ok');
      setRotateKey('');
      setRotateWebhook('');
      setShowRotate(false);
      await fetchStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rotation Failed.', 'err');
    } finally {
      setRotateLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Test address
  // ---------------------------------------------------------------------------

  async function handleTestAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!testAddr.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      // Parse a simple "street, city, state zip" string into an address object.
      const parts = testAddr.split(',').map((p) => p.trim());
      const street1 = parts[0] ?? '';
      const cityState = parts[1] ?? '';
      const csTokens = cityState.split(' ').filter(Boolean);
      const zip = csTokens.pop() ?? '';
      const state = csTokens.pop() ?? '';
      const city = csTokens.join(' ');
      const r = await fetch('/api/admin/shippo/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: { street1, city, state, zip, country: 'US' } }),
      });
      const d = await r.json();
      if (!r.ok) { setTestResult(`Error: ${d.error}`); return; }
      if (d.isValid) {
        setTestResult(`Valid Address. ${d.isResidential ? 'Residential.' : 'Commercial.'}`);
      } else {
        const msgs = (d.messages ?? []).map((m: { text: string }) => m.text).join('; ');
        setTestResult(`Invalid: ${msgs}`);
      }
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : 'Request Failed'}`);
    } finally {
      setTestLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Origins CRUD
  // ---------------------------------------------------------------------------

  function startAddOrigin() {
    setEditingOrigin(null);
    setOriginForm(EMPTY_ORIGIN);
    setShowOriginForm(true);
  }

  function startEditOrigin(o: ShippingOrigin) {
    setEditingOrigin(o.id);
    setOriginForm({
      label: o.label,
      name: o.name,
      company: o.company ?? '',
      street1: o.street1,
      street2: o.street2 ?? '',
      city: o.city,
      state: o.state,
      zip: o.zip,
      country: o.country,
      phone: o.phone,
      email: o.email,
      is_default: o.is_default,
    });
    setShowOriginForm(true);
  }

  async function handleSaveOrigin(e: React.FormEvent) {
    e.preventDefault();
    setOriginLoading(true);
    try {
      const payload = {
        label: originForm.label,
        name: originForm.name,
        company: originForm.company || undefined,
        street1: originForm.street1,
        street2: originForm.street2 || undefined,
        city: originForm.city,
        state: originForm.state,
        zip: originForm.zip,
        country: originForm.country,
        phone: originForm.phone,
        email: originForm.email,
        is_default: originForm.is_default,
      };

      let r: Response;
      if (editingOrigin) {
        r = await fetch(`/api/admin/shipping-origins/${editingOrigin}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        r = await fetch('/api/admin/shipping-origins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const d = await r.json();
      if (!r.ok) {
        if (r.status === 422 && d.suggestion) {
          const sugMsg = `Address Validation Failed. Suggested: ${d.suggestion.street1}, ${d.suggestion.city}, ${d.suggestion.state} ${d.suggestion.zip}`;
          showToast(sugMsg, 'err');
        } else {
          throw new Error(d.error ?? 'Save Failed');
        }
        return;
      }
      showToast(editingOrigin ? 'Origin Updated.' : 'Origin Created.', 'ok');
      setShowOriginForm(false);
      await fetchOrigins();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save Failed.', 'err');
    } finally {
      setOriginLoading(false);
    }
  }

  async function handleDeleteOrigin(id: string) {
    if (!confirm('Deactivate This Shipping Origin?')) return;
    try {
      const r = await fetch(`/api/admin/shipping-origins/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Delete Failed');
      showToast('Origin Deactivated.', 'ok');
      await fetchOrigins();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Deactivate Failed.', 'err');
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const modePill = (mode: 'test' | 'live' | null) => {
    if (!mode) return null;
    const bg = mode === 'live' ? 'var(--teal)' : '#f59e0b';
    const label = mode === 'live' ? 'Live' : 'Test';
    return (
      <span style={{
        display: 'inline-block',
        background: bg,
        color: mode === 'live' ? 'var(--black)' : '#000',
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        padding: '2px 8px',
        borderRadius: 100,
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', color: 'var(--silver)', textAlign: 'center' }}>
        Loading Shipping Settings...
      </div>
    );
  }

  const activeOrigins = origins.filter((o) => o.is_active);

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 900 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: toast.type === 'ok' ? 'var(--teal)' : '#e53e3e',
          color: toast.type === 'ok' ? 'var(--black)' : 'var(--white)',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
          fontSize: '0.9rem',
          maxWidth: 380,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      <h1 style={{ color: 'var(--white)', fontSize: '1.5rem', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        Shipping Settings
      </h1>

      {/* ------------------------------------------------------------------ */}
      {/* CARD 1 — Account Status                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {status?.connected ? (
            <Wifi size={20} color="var(--teal)" />
          ) : (
            <WifiOff size={20} color="#e53e3e" />
          )}
          <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700 }}>
            Account Connection
          </h2>
          {modePill(status?.mode ?? null)}
        </div>

        {status?.connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 2 }}>API Key (Last 4)</div>
                <div style={{ color: 'var(--white)', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                  shippo_****{status.last4}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 2 }}>Connected</div>
                <div style={{ color: 'var(--white)', fontSize: '0.88rem' }}>
                  {status.connected_at ? new Date(status.connected_at).toLocaleDateString() : 'Unknown'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 2 }}>Last Validated</div>
                <div style={{ color: status.last_validated_at ? 'var(--teal)' : '#e53e3e', fontSize: '0.88rem' }}>
                  {status.last_validated_at
                    ? new Date(status.last_validated_at).toLocaleString()
                    : 'Not Validated'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 2 }}>Webhook</div>
                <div style={{ color: status.webhook_configured ? 'var(--teal)' : 'var(--silver)', fontSize: '0.88rem' }}>
                  {status.webhook_configured ? 'Configured' : 'Not Configured'}
                </div>
              </div>
            </div>
            {status.last_validation_error && (
              <div style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid #e53e3e', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', color: '#e53e3e', fontSize: '0.82rem' }}>
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                Last Validation Error: {status.last_validation_error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button
                id="btn-shippo-rotate-toggle"
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
                onClick={() => setShowRotate(!showRotate)}
              >
                <RotateCcw size={14} />
                Rotate Key
              </button>
              <button
                id="btn-shippo-disconnect"
                className="btn-danger"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
                onClick={handleDisconnect}
              >
                <X size={14} />
                Disconnect
              </button>
            </div>

            {showRotate && (
              <form onSubmit={handleRotate} style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ color: 'var(--silver)', fontSize: '0.82rem' }}>
                  Enter New API Key (MFA Will Be Verified)
                </div>
                <input
                  id="rotate-api-key"
                  className="input"
                  type="password"
                  placeholder="shippo_test_... or shippo_live_..."
                  value={rotateKey}
                  onChange={(e) => setRotateKey(e.target.value)}
                  required
                />
                <input
                  id="rotate-webhook-secret"
                  className="input"
                  type="password"
                  placeholder="Webhook Secret (Optional)"
                  value={rotateWebhook}
                  onChange={(e) => setRotateWebhook(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button id="btn-rotate-submit" className="btn-primary" type="submit" disabled={rotateLoading} style={{ fontSize: '0.85rem' }}>
                    {rotateLoading ? 'Rotating...' : 'Confirm Rotation'}
                  </button>
                  <button type="button" className="btn-ghost" style={{ fontSize: '0.85rem' }} onClick={() => setShowRotate(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ color: 'var(--silver)', fontSize: '0.88rem', marginBottom: 'var(--space-1)' }}>
              Connect Your Shippo Platform Account To Enable Live Carrier Rates And Label Purchasing.
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.8rem', marginBottom: 4 }}>
                  API Key
                </label>
                <input
                  id="connect-api-key"
                  className="input"
                  type="password"
                  placeholder="shippo_test_... or shippo_live_..."
                  value={connectKey}
                  onChange={(e) => setConnectKey(e.target.value)}
                  required
                />
              </div>
              <div style={{ minWidth: 120 }}>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.8rem', marginBottom: 4 }}>
                  Mode
                </label>
                <select
                  id="connect-mode"
                  className="input"
                  value={connectMode}
                  onChange={(e) => setConnectMode(e.target.value as 'test' | 'live')}
                >
                  <option value="test">Test</option>
                  <option value="live">Live</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.8rem', marginBottom: 4 }}>
                Webhook Signing Secret (Optional)
              </label>
              <input
                id="connect-webhook-secret"
                className="input"
                type="password"
                placeholder="HMAC Signing Secret From Shippo Dashboard"
                value={connectWebhook}
                onChange={(e) => setConnectWebhook(e.target.value)}
              />
            </div>
            <button id="btn-connect-submit" className="btn-primary" type="submit" disabled={connectLoading} style={{ alignSelf: 'flex-start' }}>
              {connectLoading ? 'Connecting...' : 'Connect Shippo'}
            </button>
          </form>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CARD 2 — Warehouse Origins                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Package size={20} color="var(--teal)" />
            <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700 }}>
              Warehouse Origins
            </h2>
            <span style={{ background: 'rgba(0,196,188,0.1)', color: 'var(--teal)', borderRadius: 100, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
              {activeOrigins.length} Active
            </span>
          </div>
          <button
            id="btn-add-origin"
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            onClick={startAddOrigin}
          >
            <Plus size={14} />
            Add Origin
          </button>
        </div>

        {showOriginForm && (
          <form onSubmit={handleSaveOrigin} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}>
            <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.95rem' }}>
              {editingOrigin ? 'Edit Origin' : 'New Origin'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>Label</label>
                <input id="origin-label" className="input" placeholder="Main Warehouse" value={originForm.label} onChange={(e) => setOriginForm(f => ({ ...f, label: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>Contact Name</label>
                <input id="origin-name" className="input" placeholder="Fulfillment Dept" value={originForm.name} onChange={(e) => setOriginForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>Company</label>
                <input id="origin-company" className="input" placeholder="PepNationLab" value={originForm.company} onChange={(e) => setOriginForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>Street 1</label>
                <input id="origin-street1" className="input" placeholder="123 Warehouse Blvd" value={originForm.street1} onChange={(e) => setOriginForm(f => ({ ...f, street1: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>Street 2</label>
                <input id="origin-street2" className="input" placeholder="Suite 100" value={originForm.street2} onChange={(e) => setOriginForm(f => ({ ...f, street2: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>City</label>
                <input id="origin-city" className="input" placeholder="Los Angeles" value={originForm.city} onChange={(e) => setOriginForm(f => ({ ...f, city: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>State</label>
                <input id="origin-state" className="input" placeholder="CA" maxLength={2} value={originForm.state} onChange={(e) => setOriginForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} required />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>ZIP</label>
                <input id="origin-zip" className="input" placeholder="90001" value={originForm.zip} onChange={(e) => setOriginForm(f => ({ ...f, zip: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>Phone</label>
                <input id="origin-phone" className="input" type="tel" placeholder="3105551234" value={originForm.phone} onChange={(e) => setOriginForm(f => ({ ...f, phone: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 4 }}>Email</label>
                <input id="origin-email" className="input" type="email" placeholder="support@pepnationlab.com" value={originForm.email} onChange={(e) => setOriginForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', color: 'var(--silver)', fontSize: '0.88rem' }}>
              <input id="origin-is-default" type="checkbox" checked={originForm.is_default} onChange={(e) => setOriginForm(f => ({ ...f, is_default: e.target.checked }))} />
              Set As Default Origin
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button id="btn-save-origin" className="btn-primary" type="submit" disabled={originLoading} style={{ fontSize: '0.85rem' }}>
                {originLoading ? 'Saving...' : editingOrigin ? 'Update Origin' : 'Create Origin'}
              </button>
              <button type="button" className="btn-ghost" style={{ fontSize: '0.85rem' }} onClick={() => setShowOriginForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {activeOrigins.length === 0 ? (
          <div style={{ color: 'var(--silver)', fontSize: '0.88rem', textAlign: 'center', padding: 'var(--space-5)' }}>
            No Active Origins. Add A Warehouse Address To Enable Label Purchasing.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {activeOrigins.map((o) => (
              <div key={o.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.02)',
                border: o.is_default ? '1px solid var(--teal)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                gap: 'var(--space-3)',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 2 }}>
                    <span style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.92rem' }}>{o.label}</span>
                    {o.is_default && (
                      <span style={{ background: 'var(--teal)', color: 'var(--black)', fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 100 }}>Default</span>
                    )}
                    {o.shippo_address_id && (
                      <span style={{ background: 'rgba(0,196,188,0.1)', color: 'var(--teal)', fontSize: '0.65rem', padding: '1px 7px', borderRadius: 100 }}>
                        <Check size={10} style={{ display: 'inline', marginRight: 2 }} />Validated
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.82rem' }}>
                    {o.name}{o.company ? ` — ${o.company}` : ''} &middot; {o.street1}{o.street2 ? ` ${o.street2}` : ''}, {o.city}, {o.state} {o.zip}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <button
                    id={`btn-edit-origin-${o.id}`}
                    className="btn-ghost"
                    style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                    onClick={() => startEditOrigin(o)}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    id={`btn-delete-origin-${o.id}`}
                    className="btn-ghost"
                    style={{ padding: '6px 10px', fontSize: '0.82rem', color: '#e53e3e' }}
                    onClick={() => handleDeleteOrigin(o.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CARD 3 — Shipping Defaults / Test Address                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Shield size={20} color="var(--teal)" />
          <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700 }}>
            Test Address Validation
          </h2>
        </div>
        <form onSubmit={handleTestAddress} style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <input
            id="test-address-input"
            className="input"
            style={{ flex: 1, minWidth: 260 }}
            placeholder="e.g. 100 Main St, Los Angeles CA 90001"
            value={testAddr}
            onChange={(e) => setTestAddr(e.target.value)}
          />
          <button id="btn-test-address" className="btn-secondary" type="submit" disabled={testLoading || !status?.connected} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
            <RefreshCw size={14} />
            {testLoading ? 'Validating...' : 'Validate'}
          </button>
        </form>
        {!status?.connected && (
          <div style={{ color: 'var(--silver)', fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
            Connect Shippo First To Validate Addresses.
          </div>
        )}
        {testResult && (
          <div style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            background: testResult.startsWith('Valid') ? 'rgba(0,196,188,0.08)' : 'rgba(229,62,62,0.08)',
            border: testResult.startsWith('Valid') ? '1px solid var(--teal)' : '1px solid #e53e3e',
            color: testResult.startsWith('Valid') ? 'var(--teal)' : '#e53e3e',
            fontSize: '0.88rem',
          }}>
            {testResult}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CARD 4 — Rate Cards (informational)                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Truck size={20} color="var(--teal)" />
          <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700 }}>
            Rate Cards
          </h2>
        </div>
        <div style={{ color: 'var(--silver)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 var(--space-3)' }}>
            Live Carrier Rates Are Fetched At Checkout From Shippo Using The Active Platform Account.
            Allowed Carriers: <strong style={{ color: 'var(--white)' }}>USPS, UPS, FedEx, DHL Express</strong>.
          </p>
          <p style={{ margin: 0 }}>
            Fallback Weight Brackets Apply When Shippo Is Unavailable. Rates Appear As
            <strong style={{ color: '#f59e0b' }}> &ldquo;Estimated Shipping&rdquo;</strong> In The Checkout UI.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CARD 4.5 — Agent Warehouses                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Package size={20} color="var(--teal)" />
          <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700 }}>
            Agent Warehouses
          </h2>
          <span style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>
            Each Agent Ships From Their Own Warehouse Address
          </span>
        </div>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: '0 0 var(--space-4)' }}>
          Assign A Shipping Origin To Each Agent. Their Storefront Checkout Quotes And Label Purchases
          Will Use That Warehouse. Agents Without An Assignment Fall Through To The Platform Default.
        </p>
        {agentWarehouses.length === 0 ? (
          <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>No Active Agents Found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {agentWarehouses.map((agent) => (
              <div
                key={agent.id}
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 8,
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 180px' }}>
                  <span style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.9rem' }}>
                    {agent.display_name}
                  </span>
                  <br />
                  <span style={{ color: 'var(--silver)', fontSize: '0.78rem' }}>@{agent.slug}</span>
                </div>
                <div style={{ flex: '1 1 220px' }}>
                  {agent.warehouse_origin ? (
                    <span style={{ color: 'var(--teal)', fontSize: '0.85rem' }}>
                      <Check size={13} style={{ display: 'inline', marginRight: 4 }} />
                      {agent.warehouse_origin.label} — {agent.warehouse_origin.city}, {agent.warehouse_origin.state}
                    </span>
                  ) : agent.uses_legacy_warehouse ? (
                    <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
                      <AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />
                      Legacy Address (Migrate To An Origin)
                    </span>
                  ) : (
                    <span style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                      Platform Default
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flex: '0 0 auto' }}>
                  <select
                    id={`agent-origin-select-${agent.id}`}
                    defaultValue={agent.warehouse_origin_id ?? ''}
                    style={{
                      background: 'var(--surface-3)',
                      color: 'var(--white)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '10px 8px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <option value="">No Assignment (Platform Default)</option>
                    {origins.filter((o) => o.is_active).map((o) => (
                      <option key={o.id} value={o.id}>{o.label} — {o.city}, {o.state}</option>
                    ))}
                  </select>
                  <button
                    id={`agent-origin-save-${agent.id}`}
                    disabled={agentAssignLoading === agent.id}
                    onClick={async () => {
                      const sel = document.getElementById(`agent-origin-select-${agent.id}`) as HTMLSelectElement | null;
                      const newOriginId = sel?.value ?? '';
                      setAgentAssignLoading(agent.id);
                      try {
                        if (newOriginId) {
                          const r = await fetch(`/api/admin/shipping-origins/${newOriginId}/assign-agent`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ agent_id: agent.id }),
                          });
                          const d = await r.json();
                          if (!r.ok) throw new Error(d.error ?? 'Assign Failed');
                          showToast(`${agent.display_name} Now Ships From ${d.origin_label}.`, 'ok');
                        } else {
                          // Clear the assignment — call DELETE on whichever origin they currently have.
                          if (!agent.warehouse_origin_id) {
                            showToast('Agent Already Has No Assignment.', 'ok');
                            return;
                          }
                          const r = await fetch(`/api/admin/shipping-origins/${agent.warehouse_origin_id}/assign-agent`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ agent_id: agent.id }),
                          });
                          const d = await r.json();
                          if (!r.ok) throw new Error(d.error ?? 'Unassign Failed');
                          showToast(`${agent.display_name} Reset To Platform Default.`, 'ok');
                        }
                        await fetchAgentWarehouses();
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Failed.', 'err');
                      } finally {
                        setAgentAssignLoading(null);
                      }
                    }}
                    style={{
                      background: 'var(--teal)',
                      color: 'var(--black)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '10px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: agentAssignLoading === agent.id ? 0.6 : 1,
                    }}
                  >
                    {agentAssignLoading === agent.id ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CARD 5 — Webhook Status                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Shield size={20} color={status?.webhook_configured ? 'var(--teal)' : '#e53e3e'} />
          <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700 }}>
            Webhook Status
          </h2>
          {status?.connected && (
            <span style={{
              background: status.webhook_configured ? 'rgba(0,196,188,0.1)' : 'rgba(229,62,62,0.1)',
              color: status.webhook_configured ? 'var(--teal)' : '#e53e3e',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: 100,
            }}>
              {status.webhook_configured ? 'HMAC Configured' : 'No HMAC Secret'}
            </span>
          )}
        </div>
        <div style={{ color: 'var(--silver)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 var(--space-3)' }}>
            Webhook Endpoint: <code style={{ color: 'var(--teal)', background: 'rgba(0,196,188,0.08)', padding: '2px 6px', borderRadius: 4, fontSize: '0.82rem' }}>
              POST /api/webhooks/shippo
            </code>
          </p>
          {!status?.webhook_configured && (
            <p style={{ margin: 0, color: '#f59e0b' }}>
              <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
              Set SHIPPO_WEBHOOK_SECRET In Vercel Environment Variables Once Shippo Provisions Your HMAC Key.
              Without It, The Receiver Falls Back To URL-Token Mode.
            </p>
          )}
          {status?.webhook_configured && (
            <p style={{ margin: 0, color: 'var(--teal)' }}>
              <Check size={14} style={{ display: 'inline', marginRight: 6 }} />
              Webhook Signatures Will Be Verified Via HMAC-SHA256.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CARD 6 — Reconciliation                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <DollarSign size={20} color="var(--teal)" />
          <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700 }}>
            Reconciliation
          </h2>
        </div>
        <div style={{ color: 'var(--silver)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 var(--space-3)' }}>
            Automated Reconciliation Runs Every Sunday At 22:00 UTC. It Compares
            <code style={{ color: 'var(--white)', margin: '0 4px', fontSize: '0.82rem' }}>shipping_label_purchases.agent_charged_cents</code>
            Against
            <code style={{ color: 'var(--white)', margin: '0 4px', fontSize: '0.82rem' }}>orders.shipping_cost</code>
            Per Agent Per Week.
          </p>
          <p style={{ margin: 0 }}>
            A Variance Over <strong style={{ color: 'var(--white)' }}>5%</strong> Triggers An Admin In-App Alert.
            Use The <strong style={{ color: 'var(--white)' }}>Transactions</strong> And <strong style={{ color: 'var(--white)' }}>Statements</strong> Pages For Manual Review.
          </p>
        </div>
      </section>
    </div>
  );
}
