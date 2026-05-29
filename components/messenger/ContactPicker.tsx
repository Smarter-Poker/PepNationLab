'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export interface Contact {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string;
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

export default function ContactPicker({ contacts, multi, selectedIds, onChange, excludeIds }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (excludeIds?.has(c.id)) return false;
      if (!q) return true;
      const hay = `${c.full_name ?? ''} ${c.username ?? ''} ${c.email ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [contacts, query, excludeIds]);

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
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Contacts"
          aria-label="Search Contacts"
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
      <div
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
                      textTransform: 'capitalize',
                    }}
                  >
                    {c.role.replace('_', ' ')}
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
