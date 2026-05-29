'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TemplateRow {
  id: string;
  title: string;
  body: string;
  category: string | null;
  shortcut: string | null;
  usage_count: number;
}

interface Props {
  draftText: string;
  onPick: (body: string) => void;
  onClose: () => void;
}

export default function TemplatesMenu({ draftText, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-templates', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { templates?: TemplateRow[] };
        if (!cancelled) setRows(json.templates ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    const title = newTitle.trim();
    const body = draftText.trim();
    if (!title || !body) { toast('Title And Draft Required'); return; }
    try {
      const res = await fetch('/api/messenger/template', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', title, body }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Save');
        return;
      }
      const json = (await res.json()) as { template: TemplateRow };
      setRows((cur) => [json.template, ...cur]);
      setNewTitle('');
      setAdding(false);
      toast('Template Saved');
    } catch {
      toast('Network Error');
    }
  };

  const handleDelete = async (row: TemplateRow) => {
    try {
      const res = await fetch('/api/messenger/template', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: row.id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Delete');
        return;
      }
      setRows((cur) => cur.filter((r) => r.id !== row.id));
    } catch {
      toast('Network Error');
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Templates"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 12,
        zIndex: 30,
        background: 'var(--surface-3, #1D2D3E)',
        border: '1px solid var(--surface-2, #162230)',
        borderRadius: 10,
        padding: 8,
        boxShadow: '0 10px 24px rgba(0,0,0,0.6)',
        minWidth: 280,
        maxHeight: 360,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--grey-400, #A8B4C0)' }}>
          Templates
        </span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-label="Save Current Draft As Template"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 6,
            border: '1px solid var(--teal, #00C4BC)',
            background: 'transparent', color: 'var(--teal, #00C4BC)',
            cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
          }}
        >
          <Plus size={12} aria-hidden="true" />
          Save Draft
        </button>
      </div>
      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value.slice(0, 120))}
            placeholder="Template Title"
            aria-label="Template Title"
            style={{
              padding: '6px 8px', borderRadius: 6,
              border: '1px solid var(--surface-2, #162230)',
              background: 'var(--surface-1, #0F1923)',
              color: 'var(--white, #FFFFFF)', fontSize: '0.82rem',
            }}
          />
          <div style={{ fontSize: '0.7rem', color: 'var(--grey-400, #A8B4C0)' }}>
            Body: {draftText.slice(0, 80) || 'Type In The Composer First'}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { setAdding(false); setNewTitle(''); }}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 0,
                background: 'var(--surface-1, #0F1923)', color: 'var(--white, #FFFFFF)',
                cursor: 'pointer', fontSize: '0.78rem',
              }}
            >Cancel</button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 0,
                background: 'var(--teal, #00C4BC)', color: '#000',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
              }}
            >Save</button>
          </div>
        </div>
      )}
      {loading ? (
        <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 8, fontSize: '0.82rem' }}>Loading</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 8, fontSize: '0.82rem' }}>
          No Templates. Save Your First One.
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: 8, borderRadius: 6,
              background: 'var(--surface-1, #0F1923)',
              marginBottom: 6,
            }}
          >
            <button
              type="button"
              onClick={() => { onPick(row.body); onClose(); }}
              aria-label={`Insert Template ${row.title}`}
              style={{
                flex: 1, textAlign: 'left',
                background: 'transparent', border: 0, padding: 0,
                color: 'var(--white, #FFFFFF)', cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{row.title}</div>
              <div
                style={{
                  fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}
              >
                {row.body}
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(row)}
              aria-label="Delete Template"
              style={{
                background: 'transparent', border: 0, color: 'var(--danger, #E53E3E)',
                cursor: 'pointer', padding: 4,
              }}
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
