/**
 * PHONE RING TONE - Sound effect generator
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

      // Telephone-style ringing
      const playBeep = () => {
        if (!isPlaying || !audioContext) return;

        try {
          // Double UK/European style ring: 400Hz + 450Hz mixed
          // Beep 1 (0.4s)
          playDualTone(audioContext, 400, 450, audioContext.currentTime, 0.4);
          // Beep 2 (0.4s), starts after 0.2s pause
          playDualTone(audioContext, 400, 450, audioContext.currentTime + 0.6, 0.4);
        } catch (innerErr) {
          console.warn('Oscillator build error:', innerErr);
        }
      };

      playBeep();
      ringInterval = setInterval(playBeep, 3000); // Repeat every 3 seconds

    } catch (e) {
      console.warn('Ring tone error:', e);
    }
  };
  
  const playDualTone = (ctx: AudioContext, freq1: number, freq2: number, startTime: number, duration: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = freq1;
      osc2.frequency.value = freq2;
      
      // Envelopes for smooth attack and release
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05); // Attack
      gain.gain.setValueAtTime(0.15, startTime + duration - 0.05); // Sustain
      gain.gain.linearRampToValueAtTime(0, startTime + duration); // Release
      
      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);
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
