'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import AgentAccountDetail from '@/components/AgentAccountDetail';
import { freshDefaultLadder, GAMIFICATION_MAX_PCT } from '@/lib/gamification';

export default function AgentDownline({ agentId }: { agentId?: string }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Agent Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  // R31: split first/last so every Create Account form is consistent.
  // The /api/agent/agents POST still wants full_name, so we join on submit.
  const [caFirstName, setCaFirstName] = useState('');
  const [caLastName, setCaLastName] = useState('');
  const [caUsername, setCaUsername] = useState('');
  const [caPassword, setCaPassword] = useState('');
  const [caDisplayName, setCaDisplayName] = useState('');
  const [caSlug, setCaSlug] = useState('');
  const [caAccountType, setCaAccountType] = useState<'credit' | 'prepaid'>('prepaid');
  const [caCreditLimit, setCaCreditLimit] = useState('');
  const [caPrepaidBalance, setCaPrepaidBalance] = useState('');
  // Commission structure: 'fixed' = flat rate; 'gamified' = base climbs with
  // volume up to a max cap via the house milestone ladder.
  const [caCommissionMode, setCaCommissionMode] = useState<'fixed' | 'gamified'>('fixed');
  const [caCommissionPct, setCaCommissionPct] = useState('50');
  // 'default' = read-only house ladder (20% -> 40%); 'custom' = fully adjustable.
  const [caScaleType, setCaScaleType] = useState<'default' | 'custom'>('default');
  const [caCustomSteps, setCaCustomSteps] = useState(freshDefaultLadder());
  const [showGamificationInfo, setShowGamificationInfo] = useState(false);
  const [caLoading, setCaLoading] = useState(false);
  const [caError, setCaError] = useState('');
  // Default UI language for the new agent (English / Simplified / Traditional).
  const [caLocale, setCaLocale] = useState('en');

  // Reset Password State
  const [resetPwUser, setResetPwUser] = useState<{ id: string; name: string; username: string } | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwSaving, setResetPwSaving] = useState(false);

  // Agent management detail drawer
  const [detailAgent, setDetailAgent] = useState<{ id: string; name: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/agent/agents');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Fetch Agent Accounts');
      setAgents(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [agentId]);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCaError('');

    setCaLoading(true);

    try {
      const res = await fetch('/api/agent/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: `${caFirstName.trim()} ${caLastName.trim()}`.trim(),
          username: caUsername,
          password: caPassword,
          display_name: caDisplayName || caUsername,
          slug: caSlug || caUsername.toLowerCase().replace(/[^a-z0-9\-]/g, ''),
          account_type: caAccountType,
          credit_limit: caAccountType === 'credit' ? caCreditLimit : undefined,
          prepaid_balance: caAccountType === 'prepaid' ? caPrepaidBalance : undefined,
          locale: caLocale,
          // Markup this Super Agent earns on every order this new downline
          // Agent sells or restocks. Sent as an explicit number (including 0)
          // so the API can tell "no markup" apart from "use the platform
          // default"; leaving the field at its 50 prefill sends 50.
          commission_pct: caCommissionPct !== '' ? Number(caCommissionPct) : undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed To Create Agent');

      toast.success('Agent Account Created Successfully!');
      setShowCreateModal(false);
      setCaFirstName('');
      setCaLastName('');
      setCaUsername('');
      setCaPassword('');
      setCaDisplayName('');
      setCaSlug('');
      setCaCreditLimit('');
      setCaPrepaidBalance('');
      setCaCommissionMode('fixed');
      setCaCommissionPct('50');
      setCaScaleType('default');
      setCaCustomSteps(freshDefaultLadder());
      setCaLocale('en');
      fetchData();
    } catch (err: any) {
      setCaError(err.message);
    } finally {
      setCaLoading(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--silver)' }}>Loading Agent Accounts...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <div className="glass-panel">
        <div className="">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div>
              <h2 className="metal-text" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)' }}>
                My Agent Accounts
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginTop: 4 }}>
                Full Agent Accounts you have created. They have their own storefronts and set their own retail prices.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Link href="/dashboard/agent/invitations" className="btn-silver" style={{ textDecoration: 'none' }}>
                Invite Agents
              </Link>
              <button
                className="btn-neon-cyan"
                onClick={() => {
                  setCaFirstName('');
                  setCaLastName('');
                  setCaUsername('');
                  setCaPassword('');
                  setCaAccountType('prepaid');
                  setCaCreditLimit('');
                  setCaPrepaidBalance('');
                  setCaCommissionMode('fixed');
                  setCaCommissionPct('50');
                  setCaScaleType('default');
                  setCaCustomSteps(freshDefaultLadder());
                  setCaDisplayName('');
                  setCaSlug('');
                  setCaError('');
                  setShowCreateModal(true);
                }}
              >
                Create Agent Account
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {agents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', opacity: 0.5 }}>No Agent Accounts Found.</div>
            ) : (
              agents.map(agent => {
                const ap = Array.isArray(agent.agent_profiles) ? agent.agent_profiles[0] : (agent.agent_profiles || null);
                return (
                  <div 
                    key={agent.id}
                    className="glass-panel"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Agent Name</span>
                      <button
                        type="button"
                        onClick={() => setDetailAgent({ id: agent.id, name: agent.full_name || 'Agent' })}
                        style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--white)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'rgba(0,229,255,0.45)', textUnderlineOffset: '3px' }}
                        title="Manage This Agent"
                      >
                        {agent.full_name || 'Anonymous'}
                      </button>
                      {ap?.display_name && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--silver)' }}>Store: {ap.display_name}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Credentials</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#00E5FF' }}>{agent.username || (agent.email?.includes('@internal.auth') || agent.email?.includes('@pepnationlab.com') ? '' : agent.email)}</span>
                        <button
                          onClick={() => { setResetPwValue(''); setResetPwUser({ id: agent.id, name: agent.full_name || 'Agent', username: agent.username || agent.email }); }}
                          style={{ fontSize: '0.7rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textAlign: 'left' }}
                        >
                          Edit Password
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Status</span>
                      <span style={{ color: agent.is_active ? '#00FF9D' : '#FFAAAA', fontSize: '0.85rem', fontWeight: 600 }}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Last Logged In</span>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: agent.last_sign_in_at ? 'var(--silver)' : 'var(--grey-500)',
                        fontStyle: agent.last_sign_in_at ? 'normal' : 'italic',
                      }}>
                        {agent.last_sign_in_at
                          ? new Date(agent.last_sign_in_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                          : 'Never Logged In'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Storefront</span>
                      {ap?.slug ? (
                        <a href={`/${ap.slug}`} rel="noopener noreferrer" style={{ color: '#00E5FF', textDecoration: 'none', fontWeight: 600 }}>
                          /{ap.slug}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>No Storefront</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: '1 1 auto' }}>
                      <button
                        type="button"
                        className="btn-neon-cyan"
                        onClick={() => setDetailAgent({ id: agent.id, name: agent.full_name || 'Agent' })}
                        style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
                <div>
                  <h3 className="metal-text" style={{ marginTop: 0, fontSize: '1.4rem', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Create Agent Account</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginTop: '4px' }}>
                    Provision a brand new Agent with their own storefront.
                  </p>
                </div>
                <button type="button" className="btn-silver" onClick={() => setShowCreateModal(false)} disabled={caLoading}>Close</button>
              </div>

              {caError && <div style={{ background: 'rgba(255,0,0,0.1)', color: '#FFAAAA', padding: '12px', borderRadius: '6px', marginBottom: 'var(--space-4)', fontSize: '0.85rem', border: '1px solid rgba(255,0,0,0.3)' }}>{caError}</div>}

              <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* R31: First + Last Name - top-aligned grid so every create-account
                    form across admin / super-agent / agent looks the same. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', alignItems: 'start' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>First Name</label>
                    <input
                      type="text"
                      required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                      value={caFirstName}
                      onChange={e => setCaFirstName(e.target.value)}
                      placeholder="E.g., John"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Last Name</label>
                    <input
                      type="text"
                      required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                      value={caLastName}
                      onChange={e => setCaLastName(e.target.value)}
                      placeholder="E.g., Smith"
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Username</label>
                  <input
                    type="text"
                    name="new_agent_username_no_autofill"
                    required
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                    value={caUsername}
                    onChange={e => setCaUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    placeholder="Lowercase letters & numbers"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Password</label>
                  <input
                    type="password"
                    name="new_agent_password_no_autofill"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    data-lpignore="true"
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                    value={caPassword}
                    onChange={e => setCaPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Account Language</label>
                  <select
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                    value={caLocale}
                    onChange={e => setCaLocale(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="zh-CN">简体中文 (Simplified Chinese)</option>
                    <option value="zh-TW">繁體中文 (Traditional Chinese)</option>
                  </select>
                  <p style={{ marginTop: '6px', color: 'var(--grey-400)', fontSize: '0.75rem' }}>Sets The Language This Account Sees When They Log In.</p>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: 'var(--space-2) 0' }} />



                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Payment Model</label>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <label style={{ flex: 1, padding: '10px', background: 'var(--bg-metal-dark)', border: `1px solid ${caAccountType === 'prepaid' ? 'var(--teal)' : 'rgba(0,0,0,0.8)'}`, color: 'var(--white)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="radio" checked={caAccountType === 'prepaid'} onChange={() => setCaAccountType('prepaid')} />
                      Prepaid
                    </label>
                    <label style={{ flex: 1, padding: '10px', background: 'var(--bg-metal-dark)', border: `1px solid ${caAccountType === 'credit' ? 'var(--teal)' : 'rgba(0,0,0,0.8)'}`, color: 'var(--white)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="radio" checked={caAccountType === 'credit'} onChange={() => setCaAccountType('credit')} />
                      Credit Line
                    </label>
                  </div>
                </div>

                {caAccountType === 'prepaid' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Initial Prepaid Balance ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                      value={caPrepaidBalance}
                      onChange={e => setCaPrepaidBalance(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}
                {caAccountType === 'credit' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Credit Limit ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                      value={caCreditLimit}
                      onChange={e => setCaCreditLimit(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Your Markup On This Agent (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    step="1"
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                    value={caCommissionPct}
                    onChange={e => setCaCommissionPct(e.target.value)}
                    placeholder="50"
                  />
                  <p style={{ marginTop: '6px', color: 'var(--grey-400)', fontSize: '0.75rem' }}>You Earn This Percent On Top Of Your Cost On Every Order This Agent Sells Or Restocks. Leave At 50 For The Platform Default.</p>
                </div>

                <button type="submit" className="btn-neon-cyan" disabled={caLoading} style={{ marginTop: 'var(--space-2)' }}>
                  {caLoading ? 'Creating...' : 'Create Agent Account'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 400 }}>
            <div className="" style={{ padding: 'var(--space-6)' }}>
              <h3 className="metal-text" style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>Reset Agent Password</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>
                Agent: <strong style={{ color: 'var(--white)' }}>{resetPwUser.name}</strong>
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
                Username: <strong style={{ color: '#00E5FF', fontFamily: 'monospace' }}>{resetPwUser.username}</strong>
              </p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!resetPwUser || !resetPwValue) return;
                setResetPwSaving(true);
                try {
                  const res = await fetch('/api/agent/update-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: resetPwUser.id, newPassword: resetPwValue }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error);
                  toast.success('Password Updated Successfully');
                  setResetPwUser(null);
                  setResetPwValue('');
                } catch (err: any) {
                  toast.error(err.message || 'Failed To Update Password');
                } finally {
                  setResetPwSaving(false);
                }
              }}>
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>New Password</label>
                  <input
                    type="password"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                    value={resetPwValue}
                    onChange={e => setResetPwValue(e.target.value)}
                    placeholder="Minimum 8 Characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-silver" onClick={() => { setResetPwUser(null); setResetPwValue(''); }} disabled={resetPwSaving}>Cancel</button>
                  <button type="submit" className="btn-neon-cyan" disabled={resetPwSaving || resetPwValue.length < 8}>
                    {resetPwSaving ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Agent Management Detail Drawer */}
      {detailAgent && (
        <AgentAccountDetail
          agentId={detailAgent.id}
          agentName={detailAgent.name}
          onClose={() => setDetailAgent(null)}
          onChanged={fetchData}
        />
      )}


    </div>
  );
}
