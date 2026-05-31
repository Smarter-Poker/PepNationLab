'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { useMessengerStore } from '@/stores/messengerStore';
import { createClient } from '@/lib/supabase/client';

interface Props {
  conversationId: string;
  onCallStarted: (call: CallSignalRow) => void;
}

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'transform 0.1s',
};

export default function CallButton({ conversationId, onCallStarted }: Props) {
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-active-calls', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!cancelled && res.status === 503) setAvailable(false);
      } catch {
        // network issue -- keep buttons available; the click handler will surface a toast
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  const conversations = useMessengerStore((s) => s.conversations);
  const activeConv = conversations.find((c) => c.conversation_id === conversationId);
  const counterpartyId = activeConv?.counterparty_id;

  const startCall = async (callType: 'audio' | 'video') => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/messenger/call-signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', conversationId, callType }),
      });
      if (res.status === 503) {
        setAvailable(false);
        toast('Calls Not Configured');
        return;
      }
      if (!res.ok) {
        toast('Could Not Start Call');
        return;
      }
      const json = (await res.json()) as { call: CallSignalRow };

      // Broadcast calling signal directly to counterparty
      let targetUserIds: string[] = [];
      if (counterpartyId) {
        targetUserIds = [counterpartyId];
      } else {
        try {
          const partRes = await fetch('/api/messenger/list-participants', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ conversationId }),
          });
          if (partRes.ok) {
            const partJson = await partRes.json();
            const supabase = createClient();
            const currentUserId = (await supabase.auth.getSession()).data.session?.user?.id;
            targetUserIds = (partJson.participants ?? [])
              .map((p: any) => p.user_id)
              .filter((id: string) => id !== currentUserId);
          }
        } catch (err) {
          console.warn('Failed to fetch participants for call broadcast:', err);
        }
      }

      if (targetUserIds.length > 0) {
        const { broadcastCallSignal } = await import('@/lib/messenger/realtime');
        for (const tid of targetUserIds) {
          void broadcastCallSignal(tid, 'incoming_call', json.call);
        }
      } else {
        console.warn('No counterpartyId found in conversation list or participant query');
      }

      onCallStarted(json.call);
    } catch {
      toast('Network Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
      <button
        type="button"
        onClick={() => void startCall('audio')}
        disabled={busy}
        aria-label="Start Voice Call"
        title="Start Voice Call"
        className="hover-lift"
        style={iconBtn}
      >
        <img src="/messenger-icons/phone-icon.jpg" alt="Voice Call" style={{ width: 48, height: 48, objectFit: 'contain', mixBlendMode: 'screen', transform: 'scale(1.45)', filter: 'contrast(2) brightness(0.7) drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
      </button>
      <button
        type="button"
        onClick={() => void startCall('video')}
        disabled={busy}
        aria-label="Start Video Call"
        title="Start Video Call"
        className="hover-lift"
        style={iconBtn}
      >
        <img src="/messenger-icons/video-icon.jpg" alt="Video Call" style={{ width: 48, height: 48, objectFit: 'contain', mixBlendMode: 'screen', transform: 'scale(1.45)', filter: 'contrast(2) brightness(0.7) drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
      </button>
    </div>
  );
}
