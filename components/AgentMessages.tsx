'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Messaging from './Messaging';

interface Contact {
  id: string;
  full_name: string | null;
  email: string;
  username: string | null;
  role: string;
  group: 'researcher' | 'sub-agent' | 'agent';
}

/**
 * Agent-side messaging — premium FB Messenger style.
 * Shows admin, sub-agents, researchers, downline researchers.
 */
export default function AgentMessages({
  agentId,
  researchers,
}: {
  agentId: string;
  researchers: { id: string; full_name: string | null; email: string; username?: string | null }[];
}) {
  const [selected, setSelected] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    async function loadContacts() {
      setLoading(true);
      const supabase = createClient();

      const directResearchers: Contact[] = researchers.map(r => ({
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        username: r.username ?? null,
        role: 'researcher',
        group: 'researcher' as const,
      }));

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', agentId)
        .single();

      let subAgents: Contact[] = [];
      let downlineResearchers: Contact[] = [];

      if (myProfile?.role === 'super_agent') {
        const { data: subs } = await supabase
          .from('profiles')
          .select('id, full_name, email, username, role')
          .eq('parent_agent_id', agentId)
          .in('role', ['agent', 'super_agent']);

        subAgents = (subs ?? []).map(s => ({
          ...s,
          group: 'sub-agent' as const,
        }));

        if (subs && subs.length > 0) {
          const subIds = subs.map(s => s.id);
          const { data: downline } = await supabase
            .from('profiles')
            .select('id, full_name, email, username, role')
            .in('referring_agent_id', subIds)
            .eq('role', 'researcher');

          downlineResearchers = (downline ?? []).map(d => ({
            ...d,
            group: 'researcher' as const,
          }));
        }
      }

      const { data: admins } = await supabase
        .from('profiles')
        .select('id, full_name, email, username, role')
        .eq('role', 'admin')
        .limit(1);

      const adminContacts: Contact[] = (admins ?? []).map(a => ({
        ...a,
        group: 'agent' as const,
      }));

      const allContacts = [
        ...adminContacts,
        ...subAgents,
        ...directResearchers,
        ...downlineResearchers,
      ];

      const seen = new Set<string>();
      const deduped = allContacts.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      setContacts(deduped);
      setLoading(false);
    }
    loadContacts();
  }, [agentId, researchers]);

  const filtered = contacts.filter(c => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (c.full_name?.toLowerCase().includes(q)) ||
           (c.username?.toLowerCase().includes(q)) ||
           (c.email.toLowerCase().includes(q));
  });

  const getInitials = (c: Contact) =>
    (c.full_name || c.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const avatarGradient = (c: Contact) => {
    if (c.role === 'admin') return 'linear-gradient(135deg, #F6AD55 0%, #ED8936 100%)';
    if (c.group === 'sub-agent') return 'linear-gradient(135deg, #63B3ED 0%, #4299E1 100%)';
    return 'linear-gradient(135deg, #1f2937 0%, #374151 100%)';
  };

  const roleLabel = (c: Contact) => {
    if (c.role === 'admin') return 'ADMIN';
    if (c.group === 'sub-agent') return 'AGENT';
    return 'RESEARCHER';
  };

  const roleLabelColor = (c: Contact) => {
    if (c.role === 'admin') return '#F6AD55';
    if (c.group === 'sub-agent') return '#63B3ED';
    return 'rgba(255,255,255,0.25)';
  };

  return (
    <div style={{
      background: '#0a0f1a',
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.01)',
      }}>
        <h3 style={{
          fontSize: '1.1rem', margin: 0, color: '#fff',
          fontFamily: 'var(--font-brand)',
          letterSpacing: '0.04em', fontWeight: 800,
        }}>
          MESSAGES
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', margin: '4px 0 0' }}>
          Message Your Team And Admin
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 520 }}>
        {/* Contact sidebar */}
        <div style={{
          borderRight: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Search */}
          <div style={{ padding: '12px 12px 8px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 10, padding: '0 10px',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: '#fff', fontSize: '0.78rem', padding: '8px 0',
                  width: '100%', fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', margin: '0 auto 8px',
                  border: '2px solid rgba(0,196,188,0.2)', borderTopColor: 'var(--teal)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>Loading...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem' }}>
                No Contacts Found
              </div>
            ) : (
              filtered.map(c => {
                const isActive = selected?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c)}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: isActive ? 'rgba(0,196,188,0.06)' : 'transparent',
                      border: 'none',
                      borderLeft: isActive ? '3px solid var(--teal)' : '3px solid transparent',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(0,196,188,0.06)' : 'transparent'; }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: isActive ? 'linear-gradient(135deg, #00C4BC 0%, #0099FF 100%)' : avatarGradient(c),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.62rem', fontWeight: 800, color: '#fff',
                      flexShrink: 0,
                    }}>
                      {getInitials(c)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span style={{
                          fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {c.full_name || 'User'}
                        </span>
                        <span style={{
                          fontSize: '0.52rem', fontWeight: 700,
                          color: roleLabelColor(c),
                          background: `${roleLabelColor(c)}10`,
                          padding: '1px 5px', borderRadius: 3,
                          letterSpacing: '0.05em',
                          flexShrink: 0,
                        }}>
                          {roleLabel(c)}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.username ? `@${c.username}` : c.email}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread area */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <Messaging
              selfId={agentId}
              counterpartId={selected.id}
              counterpartName={selected.full_name || selected.email}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 14,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(0,196,188,0.06) 0%, rgba(0,153,255,0.06) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0,196,188,0.25)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', fontWeight: 600 }}>
                Select A Contact
              </div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
                Choose someone to start messaging
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
