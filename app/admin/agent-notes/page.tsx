'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface PickableProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string;
}

interface Note {
  id: string;
  subjectId: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string | null;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

function profileLabel(p: PickableProfile): string {
  const name = p.full_name || (p.username ? '@' + p.username : null) || p.email || p.id.slice(0, 8);
  const roleLabel = p.role === 'super_agent' ? 'Super Agent' : p.role.charAt(0).toUpperCase() + p.role.slice(1);
  return `${name} · ${roleLabel}`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function AdminAgentNotesPage() {
  const [people, setPeople] = useState<PickableProfile[]>([]);
  const [search, setSearch] = useState('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [draft, setDraft] = useState('');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingPeople(true);
      try {
        // Use the existing admin global-search endpoint with a wide scope to populate the picker.
        // Falls back to /api/admin/agents if global-search returns nothing.
        const res = await fetch('/api/admin/agents');
        if (res.ok) {
          const json = await res.json();
          // Endpoint returns { data: [...] } per the codebase pattern
          const rows: PickableProfile[] = (json.data || json.agents || []).map((r: any) => ({
            id: r.id,
            full_name: r.full_name ?? null,
            username: r.username ?? null,
            email: r.email ?? null,
            role: r.role ?? 'agent',
          }));
          setPeople(rows);
        }
      } catch {
        // Silent - picker will just be empty
      } finally {
        setLoadingPeople(false);
      }
    })();
  }, []);

  const loadNotes = useCallback(async (sid: string) => {
    if (!sid) { setNotes([]); return; }
    setLoadingNotes(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/shadow-notes?subjectId=${encodeURIComponent(sid)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Failed To Load Notes');
        setNotes([]);
      } else {
        setNotes(json.notes ?? []);
      }
    } catch {
      setErr('Network Error');
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    if (subjectId) loadNotes(subjectId);
  }, [subjectId, loadNotes]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const blob = `${p.full_name ?? ''} ${p.username ?? ''} ${p.email ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [people, search]);

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !draft.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/shadow-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, body: draft.trim(), pinned }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Failed To Save Note');
        return;
      }
      setDraft('');
      setPinned(false);
      await loadNotes(subjectId);
    } catch {
      setErr('Network Error');
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (note: Note) => {
    try {
      await fetch(`/api/admin/shadow-notes/${encodeURIComponent(note.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      await loadNotes(subjectId);
    } catch {
      setErr('Network Error');
    }
  };

  const removeNote = async (note: Note) => {
    if (!confirm('Delete This Note? This Cannot Be Undone.')) return;
    try {
      await fetch(`/api/admin/shadow-notes/${encodeURIComponent(note.id)}`, { method: 'DELETE' });
      await loadNotes(subjectId);
    } catch {
      setErr('Network Error');
    }
  };

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Shadow Notes</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 6, marginBottom: 0 }}>
            Private Internal CRM. The Subject Cannot See These Notes.
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 'var(--space-6)' }}>
        {/* Picker */}
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '0.95rem', margin: 0, marginBottom: 'var(--space-3)' }}>Pick An Agent</h3>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter By Name, Username, Or Email"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                background: 'var(--surface-1)', border: '1px solid var(--surface-3)',
                color: 'var(--white)', fontSize: '0.88rem', marginBottom: 'var(--space-3)', outline: 'none',
              }}
            />
            <div style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {loadingPeople && <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 12 }}>Loading…</div>}
              {!loadingPeople && filteredPeople.length === 0 && (
                <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 12 }}>No Agents Match.</div>
              )}
              {filteredPeople.map((p) => {
                const active = p.id === subjectId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSubjectId(p.id)}
                    style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                      background: active ? 'rgba(0,196,188,0.12)' : 'transparent',
                      border: '1px solid ' + (active ? 'var(--teal)' : 'transparent'),
                      color: active ? 'var(--teal)' : 'var(--white)',
                      cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600,
                    }}
                  >
                    {profileLabel(p)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notes column */}
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '0.95rem', margin: 0, marginBottom: 'var(--space-3)' }}>
              {subjectId ? 'Notes' : 'Select Someone To Begin'}
            </h3>

            {subjectId && (
              <>
                <form onSubmit={submitNote} style={{ marginBottom: 'var(--space-4)' }}>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add A Private Note. They Will Never See This."
                    rows={4}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      background: 'var(--surface-1)', border: '1px solid var(--surface-3)',
                      color: 'var(--white)', fontSize: '0.88rem', resize: 'vertical', outline: 'none', minHeight: 80,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--grey-400)', display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                      Pin To Top
                    </label>
                    <button
                      type="submit"
                      disabled={saving || !draft.trim()}
                      className="btn-primary"
                      style={{ opacity: saving || !draft.trim() ? 0.5 : 1, cursor: saving || !draft.trim() ? 'not-allowed' : 'pointer' }}
                    >
                      {saving ? 'Saving…' : 'Save Note'}
                    </button>
                  </div>
                </form>

                {err && (
                  <div style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.4)', color: '#FFFFFF', padding: '8px 12px', borderRadius: 8, marginBottom: 'var(--space-3)', fontSize: '0.84rem' }}>
                    {err}
                  </div>
                )}

                {loadingNotes && <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>Loading Notes…</div>}

                {!loadingNotes && notes.length === 0 && (
                  <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>
                    No Notes Yet.
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {notes.map((n) => (
                    <article
                      key={n.id}
                      style={{
                        background: 'var(--surface-1)',
                        border: '1px solid ' + (n.pinned ? 'var(--teal)' : 'var(--surface-3)'),
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-4)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', fontWeight: 600 }}>
                          {n.authorName || n.authorEmail || 'Admin'} · {formatWhen(n.createdAt)}
                          {n.updatedAt !== n.createdAt && ' · Edited'}
                        </div>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => togglePin(n)}
                            title={n.pinned ? 'Unpin' : 'Pin'}
                            style={{ background: 'transparent', border: 0, color: n.pinned ? 'var(--teal)' : 'var(--grey-400)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                          >
                            {n.pinned ? 'Pinned' : 'Pin'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeNote(n)}
                            style={{ background: 'transparent', border: 0, color: 'var(--red)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.92rem', color: 'var(--white)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {n.body}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
