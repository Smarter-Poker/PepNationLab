'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export interface Contact {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string;
  // fix-46: surface super-agent status so the picker can label & filter
  // them distinctly from regular agents (they share role='agent' in the DB).
  is_super_agent?: boolean | null;
}

interface Props {
  contacts: Contact[];
  multi: boolean;
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  excludeIds?: Set<string>;
}

function labelOf(c: Contact): string {
  return c.full_name?.trim() || c.username?.trim() || c.email?.trim() || 'Unknown';
}

// A super agent can be represented two ways in the DB: the canonical
// role='agent' + is_super_agent=true, OR a legacy role='super_agent' row left
// by the researcher-promotion path. Treat BOTH as super agents so a promoted
// account never falls through the role chips or shows a lowercase label.
function isSuperAgentContact(c: Contact): boolean {
  return c.role === 'super_agent' || (c.role === 'agent' && c.is_super_agent === true);
}

function roleLabel(c: Contact): string {
  if (c.role === 'admin') return 'Admin';
  if (isSuperAgentContact(c)) return 'Super Agent';
  if (c.role === 'agent') return 'Agent';
  if (c.role === 'researcher') return 'Researcher';
  if (c.role === 'shipping') return 'Shipping';
  return c.role.replace('_', ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

type RoleFilter = 'all' | 'admin' | 'super_agent' | 'agent' | 'researcher' | 'shipping';

const ROLE_CHIPS: Array<{ key: RoleFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'admin', label: 'Admins' },
  { key: 'super_agent', label: 'Super Agents' },
  { key: 'agent', label: 'Agents' },
  { key: 'researcher', label: 'Researchers' },
  { key: 'shipping', label: 'Shipping' },
];

export default function ContactPicker({ contacts, multi, selectedIds, onChange, excludeIds }: Props) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  // fix-46: auto-focus the search input so a typing-driven workflow is the
  // default. Small timeout so the parent dialog's open animation finishes
  // first (iOS Safari otherwise loses focus to the dialog's own focus trap).
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // fix-46: per-role available count so chips can show "(n)" tallies and
  // chips with zero users go visibly dimmed.
  const counts = useMemo(() => {
    const out: Record<RoleFilter, number> = {
      all: 0, admin: 0, super_agent: 0, agent: 0, researcher: 0, shipping: 0,
    };
    for (const c of contacts) {
      if (excludeIds?.has(c.id)) continue;
      out.all++;
      if (c.role === 'admin') out.admin++;
      else if (isSuperAgentContact(c)) out.super_agent++;
      else if (c.role === 'agent') out.agent++;
      else if (c.role === 'researcher') out.researcher++;
      else if (c.role === 'shipping') out.shipping++;
    }
    return out;
  }, [contacts, excludeIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (excludeIds?.has(c.id)) return false;
      if (roleFilter !== 'all') {
        if (roleFilter === 'super_agent') {
          if (!isSuperAgentContact(c)) return false;
        } else if (roleFilter === 'agent') {
          if (!(c.role === 'agent' && !isSuperAgentContact(c))) return false;
        } else if (c.role !== roleFilter) {
          return false;
        }
      }
      if (!q) return true;
      const hay = `${c.full_name ?? ''} ${c.username ?? ''} ${c.email ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [contacts, query, roleFilter, excludeIds]);

  const toggle = (id: string) => {
    if (multi) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange(next);
    } else {
      onChange(new Set([id]));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--surface-1, #0F1923)',
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 8,
          padding: '8px 10px',
        }}
      >
        <Search size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search By Name, Username, Or Email"
          aria-label="Search Contacts"
          autoFocus
          style={{
            flex: 1,
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: 'var(--white, #FFFFFF)',
            fontSize: '0.9rem',
          }}
        />
      </label>

      {/* fix-46: role filter chip strip. Hidden when there are no contacts. */}
      {counts.all > 0 && (
        <div
          role="tablist"
          aria-label="Filter By Role"
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 2,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {ROLE_CHIPS.map((chip) => {
            const count = counts[chip.key];
            const active = roleFilter === chip.key;
            const empty = count === 0;
            return (
              <button
                key={chip.key}
                type="button"
                role="tab"
                id={`contact-filter-tab-${chip.key}`}
                aria-selected={active}
                aria-controls="contact-picker-list"
                onClick={() => setRoleFilter(chip.key)}
                disabled={empty && chip.key !== 'all'}
                style={{
                  flexShrink: 0,
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: '1px solid ' + (active ? 'var(--teal, #00C4BC)' : 'var(--surface-3, #1D2D3E)'),
                  background: active ? 'var(--teal, #00C4BC)' : 'var(--surface-1, #0F1923)',
                  color: active ? '#000' : (empty ? 'var(--grey-500, #758594)' : 'var(--white, #FFFFFF)'),
                  cursor: empty && chip.key !== 'all' ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  opacity: empty && chip.key !== 'all' ? 0.55 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
                {count > 0 && (
                  <span style={{ marginLeft: 6, opacity: active ? 0.8 : 0.6, fontWeight: 500 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        id="contact-picker-list"
        style={{
          overflowY: 'auto',
          maxHeight: 280,
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 8,
          background: 'var(--surface-1, #0F1923)',
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--grey-400, #A8B4C0)', fontSize: '0.85rem', textAlign: 'center' }}>
            No Contacts Found
          </div>
        ) : (
          filtered.map((c) => {
            const selected = selectedIds.has(c.id);
            return (
              <label
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--surface-2, #162230)',
                  cursor: 'pointer',
                  background: selected ? 'var(--surface-2, #162230)' : 'transparent',
                }}
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name="contact-pick"
                  checked={selected}
                  onChange={() => toggle(c.id)}
                  aria-label={`Select ${labelOf(c)}`}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.92rem',
                      color: 'var(--white, #FFFFFF)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {labelOf(c)}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--grey-400, #A8B4C0)',
                    }}
                  >
                    {roleLabel(c)}
                    {c.username && ` · @${c.username}`}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>
      {multi && (
        <div style={{ fontSize: '0.78rem', color: 'var(--grey-400, #A8B4C0)' }}>
          Selected: {selectedIds.size}
        </div>
      )}
    </div>
  );
}
