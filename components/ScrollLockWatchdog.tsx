'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Safety net for the body-scroll-lock pattern used by many modals/drawers.
 * Each independently does `document.body.style.overflow = 'hidden'` and
 * restores a captured "previous" value on close. Two failure modes leave the
 * page permanently unscrollable ("can't scroll up or down") until reload:
 *   1. Overlapping overlays: the inner one captures 'hidden' as its previous
 *      and restores THAT on close, so the lock survives.
 *   2. A modal whose cleanup restores a stale 'hidden' writes the SAME value
 *      back (no style change), so nothing downstream notices the leak.
 *
 * The original watchdog only cleared a stuck lock on client navigation, and
 * only if it fired before a closing modal finished unmounting. A user who
 * hits the leak and STAYS on the page (e.g. Admin Product Manager) was left
 * stuck. This version also recovers WITHOUT a navigation: it watches the body
 * for a lock appearing and re-checks when overlays are removed, and it
 * recovers the instant the user tries to interact.
 *
 * SAFETY: it only ever clears when NOTHING is actually open — neither an ARIA
 * modal marker ([role=dialog] / [aria-modal] / [data-scroll-lock=active]) NOR
 * a visible, interactive, near-full-screen fixed overlay. Every body-locking
 * modal in this codebase satisfies at least one of those while open, so a
 * legitimately-open overlay's lock is never cleared out from under it.
 */

const MODAL_MARKERS = '[role="dialog"],[aria-modal="true"],[data-scroll-lock="active"]';

/**
 * True when something that legitimately owns a scroll-lock is on screen: an
 * ARIA-marked modal, or any visible interactive fixed element covering most of
 * the viewport (an overlay/backdrop). Marker-less modals in this app still
 * render a `position:fixed; inset:0` overlay, so they are covered too.
 */
function overlayPresent(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.querySelector(MODAL_MARKERS)) return true;
  const root = document.body;
  if (!root) return false;
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  if (vw === 0 || vh === 0) return true; // can't measure — assume something is open, never unlock blindly
  const nodes = root.querySelectorAll('*');
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i] as HTMLElement;
    const s = getComputedStyle(el);
    if (s.position !== 'fixed') continue;
    if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none') continue;
    if (parseFloat(s.opacity || '1') < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= vw * 0.8 && r.height >= vh * 0.8) return true;
  }
  return false;
}

function clearIfOrphaned(): void {
  if (typeof document === 'undefined' || !document.body) return;
  const b = document.body.style;
  const h = document.documentElement.style;
  if (b.overflow !== 'hidden' && h.overflow !== 'hidden') return; // nothing locked
  if (overlayPresent()) return; // a real modal/overlay owns this lock — leave it
  if (b.overflow === 'hidden') b.overflow = '';
  if (h.overflow === 'hidden') h.overflow = '';
  // Some lock variants also pin the body in place; only unwound once we've
  // decided the lock is orphaned (guarded by overlayPresent above).
  if (b.position === 'fixed') { b.position = ''; b.top = ''; b.width = ''; }
}

export default function ScrollLockWatchdog() {
  const pathname = usePathname();

  // Clear on every client navigation. Two passes: a modal unmounting as part
  // of the same navigation may still be in the DOM at t=0.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t1 = window.setTimeout(clearIfOrphaned, 0);
    const t2 = window.setTimeout(clearIfOrphaned, 400);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [pathname]);

  // Recover a lock that leaks WITHOUT a navigation.
  useEffect(() => {
    if (typeof window === 'undefined' || !document.body) return;

    let pending = 0;
    const scheduleCheck = (delay: number) => {
      window.clearTimeout(pending);
      pending = window.setTimeout(clearIfOrphaned, delay);
    };

    // A lock present at mount (set before this ran) — check once, deferred so a
    // modal opening on this same paint has rendered its overlay first.
    scheduleCheck(500);

    // Watch the body for (a) its style changing (a lock being applied) and
    // (b) direct children being added/removed (portaled modals mount/unmount).
    // On either, if a lock is active, re-check after a delay long enough for a
    // genuinely-opening modal to have rendered its overlay.
    const onMutate = () => {
      if (document.body.style.overflow === 'hidden' || document.documentElement.style.overflow === 'hidden') {
        scheduleCheck(600);
      }
    };
    const obs = new MutationObserver(onMutate);
    obs.observe(document.body, { attributes: true, attributeFilter: ['style'], childList: true });

    // The decisive recovery: the moment the user tries to interact/scroll, if
    // the page is locked with nothing actually open, unlock immediately. This
    // is safe (a real overlay is detected and preserved) and turns a dead page
    // back into a scrollable one on the user's first touch.
    const onIntent = () => clearIfOrphaned();
    window.addEventListener('touchstart', onIntent, { passive: true });
    window.addEventListener('pointerdown', onIntent, { passive: true });
    window.addEventListener('wheel', onIntent, { passive: true });
    document.addEventListener('visibilitychange', onIntent);

    return () => {
      obs.disconnect();
      window.clearTimeout(pending);
      window.removeEventListener('touchstart', onIntent);
      window.removeEventListener('pointerdown', onIntent);
      window.removeEventListener('wheel', onIntent);
      document.removeEventListener('visibilitychange', onIntent);
    };
  }, []);

  return null;
}
