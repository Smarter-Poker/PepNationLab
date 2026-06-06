/**
 * Singleton AudioContext shared across all messenger audio (ringtones,
 * notification beeps, call-ended sounds). Centralizing it lets us solve
 * the iOS Safari autoplay restriction once, at module load, instead of
 * fighting it from every audio-emitting code path.
 *
 * iOS rules (and other browsers, increasingly): a fresh AudioContext
 * starts in `state === 'suspended'` and cannot play sound until
 * `resume()` is called from a synchronous user-gesture handler. Calling
 * `resume()` from an async callback (e.g. a Supabase realtime event
 * handler that fires when an incoming call arrives) does NOT count as
 * a gesture, so the ringtone stays silent.
 *
 * Workaround: at module load, register a one-shot listener on
 * pointerdown / touchstart / keydown. The first time the user
 * interacts with the page in ANY way, the listener resumes the
 * AudioContext. Subsequent audio plays without needing its own
 * gesture, because the context is already running.
 */

let ctx: AudioContext | null = null;
let unlockBound = false;

function getCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function bindGestureUnlock(target: AudioContext) {
  if (unlockBound || typeof window === 'undefined') return;
  unlockBound = true;

  const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown', 'click'];
  const handler = () => {
    if (target.state === 'suspended') {
      target.resume().catch((err) => {
        console.warn('[audioContext] resume rejected:', err);
      });
    }
    for (const e of events) {
      window.removeEventListener(e, handler, true);
    }
  };
  for (const e of events) {
    // capture: true so we win even if a child handler stopPropagation's.
    window.addEventListener(e, handler, { capture: true, once: false, passive: true });
  }
}

/**
 * Returns the shared AudioContext, creating it on first call. Returns
 * null in SSR / unsupported environments - callers should gracefully
 * no-op when they receive null.
 *
 * The context is registered for gesture-based unlock on creation, so
 * by the time the user does anything tap-like, it's already resumed.
 */
export function getSharedAudioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = getCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch (err) {
    console.warn('[audioContext] construction failed:', err);
    return null;
  }
  bindGestureUnlock(ctx);
  return ctx;
}

/**
 * Optional explicit unlock - callers that have access to a real user
 * gesture (e.g. CallButton click handler) can invoke this to resume
 * the context immediately, bypassing the deferred listener. Safe to
 * call repeatedly.
 */
export function unlockSharedAudioContext(): void {
  const c = getSharedAudioContext();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().catch((err) => {
      console.warn('[audioContext] explicit unlock rejected:', err);
    });
  }
}
