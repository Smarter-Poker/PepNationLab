'use client';
import { useCallback, useEffect, useState } from 'react';
import { X, Bell, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReminderRow {
  id: string;
  user_id: string;
  message_id: string | null;
  conversation_id: string | null;
  remind_at: string;
  note: string | null;
  message_preview: string | null;
  status: 'pending' | 'fired' | 'cancelled' | 'dismissed';
  fired_at: string | null;
  created_at: string;
}

interface Props {
  onClose: () => void;
  // Optional seed for create-mode: pre-fills the form with a message reference
  // and its preview so the user only has to pick a time.
  seed?: {
    messageId?: string;
    conversationId?: string;
    preview?: string;
  } | null;
}

function formatRemindAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function relativeFromNow(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const ms = t - Date.now();
  const abs = Math.abs(ms);
  const future = ms > 0;
  const min = Math.round(abs / 60_000);
  if (min < 60) {
    if (min < 1) return future ? 'In Less Than A Minute' : 'Just Now';
    return future ? `In ${min} Minutes` : `${min} Minutes Ago`;
  }
  const hr = Math.round(min / 60);
  if (hr < 48) return future ? `In ${hr} Hours` : `${hr} Hours Ago`;
  const days = Math.round(hr / 24);
  return future ? `In ${days} Days` : `${days} Days Ago`;
}

export default function RemindersList({ onClose, seed = null }: Props) {
  const [rows, setRows] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(Boolean(seed));
  const [remindAt, setRemindAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messenger/list-reminders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        toast('Could Not Load Reminders');
        return;
      }
      const json = (await res.json()) as { reminders?: ReminderRow[] };
      setRows(json.reminders ?? []);
    } catch {
      toast('Network Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!remindAt) {
      toast('Pick A Time First');
      return;
    }
    const t = Date.parse(remindAt);
    if (Number.isNaN(t)) {
      toast('Invalid Time');
      return;
    }
    if (t < Date.now() + 30_000) {
      toast('Pick A Time At Least Thirty Seconds Away');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        remindAt: new Date(t).toISOString(),
      };
      if (note.trim().length > 0) body.note = note.trim().slice(0, 500);
      if (seed?.messageId) body.messageId = seed.messageId;
      if (seed?.conversationId) body.conversationId = seed.conversationId;
      const res = await fetch('/api/messenger/reminder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Set Reminder');
        return;
      }
      setRemindAt('');
      setNote('');
      setCreating(false);
      toast('Reminder Set');
      void load();
    } catch {
      toast('Network Error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (row: ReminderRow) => {
    setBusy((cur) => ({ ...cur, [row.id]: true }));
    try {
      const res = await fetch('/api/messenger/cancel-reminder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reminderId: row.id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Cancel');
        return;
      }
      setRows((cur) => cur.filter((r) => r.id !== row.id));
      toast('Reminder Cancelled');
    } catch {
      toast('Network Error');
    } finally {
      setBusy((cur) => {
        const next = { ...cur };
        delete next[row.id];
        return next;
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Reminders"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(360px, 100%)',
        background: 'var(--surface-1, #0F1923)',
        borderLeft: '1px solid var(--surface-3, #1D2D3E)',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--surface-3, #1D2D3E)',
          background: 'var(--surface-2, #162230)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--white, #FFFFFF)', fontWeight: 700 }}>
          <Bell size={16} aria-hidden="true" />
          Reminders
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Reminders"
          style={{
            background: 'transparent',
            border: 0,
            color: 'var(--white, #FFFFFF)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 0,
              background: 'var(--teal, #00C4BC)',
              color: '#000',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.84rem',
            }}
          >
            Set Reminder
          </button>
        )}

        {creating && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: 'var(--surface-2, #162230)',
              border: '1px solid var(--surface-3, #1D2D3E)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {seed?.preview && (
              <div
                style={{
                  padding: 6,
                  borderRadius: 6,
                  background: 'var(--surface-1, #0F1923)',
                  border: '1px solid var(--surface-3, #1D2D3E)',
                  color: 'var(--grey-400, #A8B4C0)',
                  fontSize: '0.78rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {seed.preview}
              </div>
            )}
            <label
              htmlFor="reminder-at-input"
              style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)' }}
            >
              Remind Me At
            </label>
            <input
              id="reminder-at-input"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              aria-label="Reminder Date And Time"
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid var(--surface-3, #1D2D3E)',
                background: 'var(--surface-1, #0F1923)',
                color: 'var(--white, #FFFFFF)',
                fontSize: '0.85rem',
              }}
            />
            <label
              htmlFor="reminder-note-input"
              style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)' }}
            >
              Note
            </label>
            <textarea
              id="reminder-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              maxLength={500}
              aria-label="Reminder Note"
              placeholder="Optional Note"
              style={{
                padding: 6,
                borderRadius: 6,
                border: '1px solid var(--surface-3, #1D2D3E)',
                background: 'var(--surface-1, #0F1923)',
                color: 'var(--white, #FFFFFF)',
                fontSize: '0.85rem',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setRemindAt('');
                  setNote('');
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--surface-3, #1D2D3E)',
                  background: 'transparent',
                  color: 'var(--white, #FFFFFF)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 0,
                  background: 'var(--teal, #00C4BC)',
                  color: '#000',
                  cursor: saving ? 'wait' : 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--grey-400, #A8B4C0)', textAlign: 'center', marginTop: 16 }}>
            Loading Reminders
          </div>
        ) : rows.length === 0 ? (
          <div style={{ color: 'var(--grey-400, #A8B4C0)', textAlign: 'center', marginTop: 16 }}>
            No Reminders Set
          </div>
        ) : (
          rows.map((r) => {
            const isBusy = Boolean(busy[r.id]);
            return (
              <div
                key={r.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: 'var(--surface-2, #162230)',
                  border: '1px solid var(--surface-3, #1D2D3E)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      color: 'var(--white, #FFFFFF)',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                    }}
                  >
                    {formatRemindAt(r.remind_at)}
                  </div>
                  <div
                    style={{
                      color: 'var(--teal, #00C4BC)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    {relativeFromNow(r.remind_at)}
                  </div>
                </div>
                {r.note && (
                  <div
                    style={{
                      color: 'var(--white, #FFFFFF)',
                      fontSize: '0.84rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {r.note}
                  </div>
                )}
                {r.message_preview && (
                  <div
                    style={{
                      color: 'var(--grey-400, #A8B4C0)',
                      fontSize: '0.78rem',
                      fontStyle: 'italic',
                      borderLeft: '2px solid var(--surface-3, #1D2D3E)',
                      paddingLeft: 6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {r.message_preview}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => void handleCancel(r)}
                    disabled={isBusy}
                    aria-label="Cancel Reminder"
                    title="Cancel Reminder"
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--red, #E53E3E)',
                      background: 'transparent',
                      color: 'var(--red, #E53E3E)',
                      cursor: isBusy ? 'wait' : 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Trash2 size={12} />
                    Cancel
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
