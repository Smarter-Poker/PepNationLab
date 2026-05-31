'use client';
import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { toast } from 'sonner';

interface Props {
  call: CallSignalRow;
  onAccept: () => void;
  onDecline: () => void;
  stackIndex?: number;
}

// fix-39: bumped sizes (320 -> 340 min width, 64px tall buttons) and forced
// safe-area-inset offsets so iOS Safari shows the toast as a real
// notification card, not the "tiny square" the user reported.
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

    import('@/lib/messenger/haptics').then(h => {
      h.initHaptics();
      h.vibrateMedium();
    });

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
        // fix-39: honor iOS safe-area-inset so the toast is not hidden
        // behind the dynamic island / notch / status bar.
        top: `calc(env(safe-area-inset-top, 0px) + ${16 + stackIndex * 132}px)`,
        right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
        background: 'var(--surface-2, #162230)',
        border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 14,
        padding: 18,
        boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
        zIndex: 1500,
        minWidth: 340,
        maxWidth: 'calc(100vw - 32px)',
        color: 'var(--white, #FFFFFF)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {isVideo ? <Video size={22} aria-hidden="true" /> : <Phone size={22} aria-hidden="true" />}
        <div>
          <div style={{ fontSize: '0.82rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{callerName}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleAction('accept')}
          style={{
            flex: 1,
            minHeight: 48,
            background: 'var(--teal, #00C4BC)',
            color: '#000',
            border: 0,
            padding: '12px 14px',
            borderRadius: 10,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontWeight: 700,
            fontSize: '0.95rem',
          }}
          aria-label="Accept"
          title="Accept"
        >
          <Phone size={16} aria-hidden="true" /> Accept
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleAction('decline')}
          style={{
            flex: 1,
            minHeight: 48,
            background: 'var(--red, #E53E3E)',
            color: '#FFFFFF',
            border: 0,
            padding: '12px 14px',
            borderRadius: 10,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontWeight: 700,
            fontSize: '0.95rem',
          }}
          aria-label="Decline"
          title="Decline"
        >
          <PhoneOff size={16} aria-hidden="true" /> Decline
        </button>
      </div>
    </div>
  );
}
