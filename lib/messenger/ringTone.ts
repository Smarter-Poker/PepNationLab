/**
 * PHONE RING TONE - Sound effect generator
 * Uses Web Audio API to create a gentle, pleasant ring tone
 */

import { getSharedAudioContext } from './audioContext';

export interface RingTone {
  start: () => void;
  stop: () => void;
}

export function createRingTone(): RingTone | null {
  if (typeof window === 'undefined') return null;

  let isPlaying = false;
  let ringInterval: ReturnType<typeof setInterval> | null = null;

  // Need to track oscillators to stop them mid-beep if hung up
  let activeOscillators: OscillatorNode[] = [];

  const start = () => {
    if (isPlaying) return;
    // audit15 fix-11: use the shared gesture-unlocked AudioContext instead of
    // a fresh one. iOS Safari refuses to autoplay sound from a per-create
    // ctx whose `resume()` was called outside a user gesture (the answerer's
    // ringtone fires from a realtime event handler, NOT a click).
    const audioContext = getSharedAudioContext();
    if (!audioContext) return;
    isPlaying = true;

    try {
      // Telephone-style ringing
      const playBeep = () => {
        if (!isPlaying) return;

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

      activeOscillators.push(osc1, osc2);

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

      // Cleanup finished oscillators
      osc1.onended = () => {
          activeOscillators = activeOscillators.filter(o => o !== osc1 && o !== osc2);
      };
  };

  const stop = () => {
    if (!isPlaying && !ringInterval) return; // Already stopped
    isPlaying = false;

    // Stop any currently playing oscillators immediately
    activeOscillators.forEach(osc => {
        try { osc.stop(); } catch(e) {}
    });
    activeOscillators = [];

    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }

    // audit15 fix-11: do NOT close the shared AudioContext on stop.
    // Closing it would force the next ring to wait for a fresh user
    // gesture (which is exactly the iOS bug this module is fixing).
    // The shared singleton stays warm for the next call.
  };

  return { start, stop };
}
