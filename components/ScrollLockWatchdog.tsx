'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Safety net for the body-scroll-lock pattern used by many modals/drawers.
 * Each independently does `document.body.style.overflow = 'hidden'` and
 * restores a captured "previous" value on close. When two overlap, the inner
 * one can capture 'hidden' as its previous and restore THAT on close, leaving
 * the body permanently locked (page won't scroll) until reload.
 *
 * On every client navigation we clear a stuck lock — but ONLY when no modal is
 * actually open, so we never unlock behind a legitimately-open overlay. The
 * check is deferred to the end of the commit so a modal that opens as part of
 * the same navigation has mounted before we look for it.
 */
export default function ScrollLockWatchdog() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = window.setTimeout(() => {
      if (document.body.style.overflow !== 'hidden') return;
      const modalOpen = document.querySelector(
        '[role="dialog"],[aria-modal="true"],[data-scroll-lock="active"]'
      );
      if (!modalOpen) {
        document.body.style.overflow = '';
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
