'use client';
import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { toast } from 'sonner';

interface Props {
  call: CallSignalRow;
  onAccept: () => void;
  onDecline: () => void;
  // Audit2: stack-offset index so multiple simultaneous rings do not overlap
  // at the same top/right anchor. Driven by MessengerShell which knows the
  // queued order.
  stackIndex?: number;
}

export default function IncomingCallToast({ call, onAccept, onDecline, stackIndex = 0 }: Props) {
  const [callerName, setCallerName] = useState<string>('Someone');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-participants', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId: call.conversation_id }),
        });
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as {
          participants?: Array<{
            user_id: string;
            full_name?: string | null;
            username?: string | null;
          }>;
        };
        const caller = (json.participants ?? []).find((p) => p.user_id === call.initiator_id);
        if (caller && !cancelled) {
          const name = caller.full_name ?? caller.username ?? 'Someone';
          setCallerName(name);
        }
      } catch {
        // non-fatal -- keep default name
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call.conversation_id, call.initiator_id]);

  const handleAction = async (action: 'accept' | 'decline') => {
    if (isBusy) return;
    setIsBusy(true);

    // audit15: stamp the per-tab "I answered this call" flag BEFORE firing
    // the HTTP request. Supabase Realtime can deliver the postgres_changes
    // UPDATE event on this same client before the accept HTTP response
    // returns; if the flag is not yet set when that update arrives, the
    // GlobalCallListener "another tab answered" guard fires and tears down
    // the overlay. Setting it pre-HTTP closes the race.
    if (action === 'accept') {
      try { sessionStorage.setItem('answered_call_' + call.id, 'true'); } catch {}
    }

    let success = false;
    try {
      const res = await fetch('/api/messenger/call-signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, callId: call.id }),
      });
      success = res.ok;
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || `Could not ${action} call`);
      }
    } catch {
      toast.error('Network Error');
    } finally {
      setIsBusy(false);
    }

    if (action === 'accept') {
      if (success) {
        onAccept();
      } else {
        // If accept failed (e.g. caller hung up), immediately remove toast locally
        onDecline();
      }
    } else {
      onDecline();
    }
  };

  const isVideo = call.call_type === 'video';

  return (
    <div
      role="alertdialog"
      aria-label="Incoming Call"
      style={{
        position: 'fixed',
        top: 16 + stackIndex * 112,
        right: 16,
        background: 'var(--surface-2, #162230)',
        border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 1500,
        minWidth: 280,
        color: 'var(--white, #FFFFFF)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {isVideo ? <Video size={18} aria-hidden="true" /> : <Phone size={18} aria-hidden="true" />}
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400, #A8B4C0)' }}>
            {isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
          </div>
          <div style={{ fontWeight: 700 }}>{callerName}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleAction('accept')}
          style={{
            flex: 1,
            background: 'var(--teal, #00C4BC)',
            color: '#000',
            border: 0,
            padding: '8px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontWeight: 600,
          }}
          aria-label="Accept"
          title="Accept"
        >
          <Phone size={14} aria-hidden="true" /> Accept
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleAction('decline')}
          style={{
            flex: 1,
            background: 'var(--red, #E53E3E)',
            color: '#FFFFFF',
            border: 0,
            padding: '8px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontWeight: 600,
          }}
          aria-label="Decline"
          title="Decline"
        >
          <PhoneOff size={14} aria-hidden="true" /> Decline
        </button>
      </div>
    </div>
  );
}
