'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { useMessengerStore } from '@/stores/messengerStore';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

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

  const triggerStartHaptics = () => {
    import('@/lib/messenger/haptics').then((h) => {
      h.initHaptics();
      h.vibrateMedium();
      h.playPopSound();
    });
  };

  // audit15: this hook MUST be called before any conditional return below
  // (Rules of Hooks). Previously useMessengerStore lived after the
  // `if (!available) return null;` guard, which crashed the messenger pane
  // the moment list-active-calls returned 503.
  const conversations = useMessengerStore((s) => s.conversations);
  const activeConv = conversations.find((c) => c.conversation_id === conversationId);
  const counterpartyId = activeConv?.counterparty_id;

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

  const startCall = async (callType: 'audio' | 'video') => {
    if (busy) return;
    setBusy(true);
    triggerStartHaptics();
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
        <Image src="/messenger-icons/phone-icon.png" alt="Voice Call" width={48} height={48} unoptimized style={{ width: 48, height: 48, objectFit: 'contain', transform: 'scale(1.6)' }} />
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
        <Image src="/messenger-icons/video-icon.png" alt="Video Call" width={48} height={48} unoptimized style={{ width: 48, height: 48, objectFit: 'contain', transform: 'scale(1.6)' }} />
      </button>
    </div>
  );
}
