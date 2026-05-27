'use client';

import { useState } from 'react';
import Messaging from './Messaging';

interface Researcher {
  id: string;
  full_name: string | null;
  email: string;
}

/**
 * Agent-side message inbox. Lists the agent's referred researchers and
 * opens a direct thread with the selected one.
 */
export default function AgentMessages({
  agentId,
  researchers,
}: {
  agentId: string;
  researchers: Researcher[];
}) {
  const [selected, setSelected] = useState<Researcher | null>(null);

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
        Researcher Messages
      </h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
        Message Researchers Who Registered Through Your Storefront.
      </p>

      {researchers.length === 0 ? (
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-8) 0' }}>
          No Referred Researchers To Message Yet.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--space-5)' }}>
          {/* Researcher list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {researchers.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                style={{
                  textAlign: 'left',
                  background: selected?.id === r.id ? 'rgba(0,196,188,0.08)' : 'var(--surface-2)',
                  border: `1px solid ${selected?.id === r.id ? 'var(--teal)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--silver)' }}>
                  {r.full_name || 'Researcher'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>{r.email}</div>
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
                Select A Researcher To Open The Conversation.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
