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
 * Agent-side messaging. Shows all contacts the agent can message:
 * - Their researchers (referring_agent_id = me)
 * - Their sub-agents (parent_agent_id = me) — for super_agents
 * - Downline researchers (for super_agents: researchers of their agents)
 * - Admin (for replying to admin messages)
 */
export default function AgentMessages({
  agentId,
  researchers,
}: {
  agentId: string;
  researchers: { id: string; full_name: string | null; email: string }[];
}) {
  const [selected, setSelected] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    async function loadContacts() {
      setLoading(true);
      const supabase = createClient();

      // Start with direct researchers
      const directResearchers: Contact[] = researchers.map(r => ({
        ...r,
        username: null,
        role: 'researcher',
        group: 'researcher' as const,
      }));

      // Fetch my profile to check role
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', agentId)
        .single();

      let subAgents: Contact[] = [];
      let downlineResearchers: Contact[] = [];

      // If super_agent, fetch sub-agents and their downline researchers
      if (myProfile?.role === 'super_agent') {
        // Sub-agents (parent_agent_id = me)
        const { data: subs } = await supabase
          .from('profiles')
          .select('id, full_name, email, username, role')
          .eq('parent_agent_id', agentId)
          .in('role', ['agent', 'super_agent']);

        subAgents = (subs ?? []).map(s => ({
          ...s,
          group: 'sub-agent' as const,
        }));

        // Downline researchers: researchers whose referring_agent_id is one of my sub-agents
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

      // Fetch admin for reply access
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, full_name, email, username, role')
        .eq('role', 'admin')
        .limit(1);

      const adminContacts: Contact[] = (admins ?? []).map(a => ({
        ...a,
        group: 'agent' as const, // display in the admin section
      }));

      // Combine all — admin first, then sub-agents, then researchers, then downline
      const allContacts = [
        ...adminContacts,
        ...subAgents,
        ...directResearchers,
        ...downlineResearchers,
      ];

      // Deduplicate by id
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

  const groupLabel = (c: Contact) => {
    if (c.role === 'admin') return 'Admin';
    if (c.group === 'sub-agent') return 'Agent';
    return 'Researcher';
  };

  const groupColor = (c: Contact) => {
    if (c.role === 'admin') return '#F6AD55';
    if (c.group === 'sub-agent') return '#63B3ED';
    return 'var(--grey-400)';
  };

  return (
    <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
      <h3
        style={{
          fontSize: '1.1rem',
          color: 'var(--white)',
          marginBottom: 'var(--space-2)',
          fontFamily: 'var(--font-brand)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Direct Messages
      </h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
        Message Your Team Members And Admin.
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, width: '100%' }} />)}
        </div>
      ) : contacts.length === 0 ? (
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-8) 0' }}>
          No Contacts Available To Message Yet.
        </p>
      ) : (
        <>
          {/* Search */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search Contacts..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ margin: 0, fontSize: '0.82rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--space-5)' }}>
            {/* Contact list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 500, overflowY: 'auto' }}>
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c)}
                  style={{
                    textAlign: 'left',
                    background: selected?.id === c.id ? 'rgba(0,196,188,0.08)' : 'var(--surface-2)',
                    border: `1px solid ${selected?.id === c.id ? 'var(--teal)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3) var(--space-4)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--silver)' }}>
                      {c.full_name || 'User'}
                    </div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: groupColor(c), background: `${groupColor(c)}15`, padding: '1px 6px', borderRadius: 4 }}>
                      {groupLabel(c)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>
                    {c.username ? `@${c.username}` : c.email}
                  </div>
                </button>
              ))}
            </div>

            {/* Thread */}
            <div>
              {selected ? (
                <Messaging
                  selfId={agentId}
                  counterpartId={selected.id}
                  counterpartName={selected.full_name || selected.email}
                />
              ) : (
                <div
                  style={{
                    height: 460,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--surface-2)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--grey-400)',
                    fontSize: '0.85rem',
                  }}
                >
                  Select A Contact To Open The Conversation.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
