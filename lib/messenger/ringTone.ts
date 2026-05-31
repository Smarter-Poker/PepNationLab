/**
 * PHONE RING TONE - Soft beep-beep sound for outgoing calls
 * Uses Web Audio API to create a gentle, pleasant ring tone
 */

export interface RingTone {
  start: () => void;
  stop: () => void;
}

export function createRingTone(): RingTone | null {
  if (typeof window === 'undefined') return null;

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  let audioContext: AudioContext | null = null;
  let isPlaying = false;
  let ringInterval: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    if (isPlaying) return;

    try {
      audioContext = new AudioContextClass();
      isPlaying = true;
      if (audioContext.state === 'suspended') {
        void audioContext.resume();
      }

      // Soft beep-beep pattern
      const playBeep = () => {
        if (!isPlaying || !audioContext) return;

        try {
          // First beep
          const osc1 = audioContext.createOscillator();
          const gain1 = audioContext.createGain();
          osc1.connect(gain1);
          gain1.connect(audioContext.destination);

          osc1.type = 'sine';
          osc1.frequency.value = 800; // Higher, softer pitch
          gain1.gain.value = 0.15; // Quiet volume

          osc1.start(audioContext.currentTime);
          gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          osc1.stop(audioContext.currentTime + 0.15);

          // Second beep (after short pause)
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);

          osc2.type = 'sine';
          osc2.frequency.value = 800;
          gain2.gain.setValueAtTime(0.15, audioContext.currentTime + 0.25);

          osc2.start(audioContext.currentTime + 0.25);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
          osc2.stop(audioContext.currentTime + 0.4);
        } catch (innerErr) {
          console.warn('Oscillator build error:', innerErr);
        }
      };

      playBeep();
      ringInterval = setInterval(playBeep, 2000); // Repeat every 2 seconds

    } catch (e) {
      console.warn('Ring tone error:', e);
    }
  };

  const stop = () => {
    if (!isPlaying && !ringInterval && !audioContext) return; // Already stopped
    isPlaying = false;
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
    if (audioContext) {
      try {
        void audioContext.close();
      } catch (e) {
        console.warn('[App] Handled exception:', e);
      }
      audioContext = null;
    }
  };

  return { start, stop };
}
