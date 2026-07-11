'use client';

/**
 * Shared dialog accessibility hook (WCAG 2.1.2, 2.4.3, 2.4.7).
 *
 * Attach the returned ref to a modal/drawer container while `active` is true to get:
 * - Initial focus moved into the dialog (first focusable element, or the
 *   provided initialFocusRef, or the container itself)
 * - A Tab/Shift+Tab focus trap bounded to the dialog
 * - Escape-to-close when an onClose callback is provided (omit it for
 *   mandatory gates like the compliance disclaimer)
 * - Focus restored to the previously focused trigger on close/unmount
 */

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface ModalA11yOptions {
  onClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  options: ModalA11yOptions = {},
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const onCloseRef = useRef(options.onClose);
  onCloseRef.current = options.onClose;
  const initialFocusRef = options.initialFocusRef;

  useEffect(() => {
    if (!active) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;

    // Move focus into the dialog on the next frame so the content has rendered.
    const focusFrame = requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ||
        container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ||
        container;
      target?.focus?.();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const trap = containerRef.current;
      if (!trap) return;

      const focusables = Array.from(
        trap.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) =>
          el.offsetParent !== null ||
          el === document.activeElement ||
          el.getClientRects().length > 0,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        trap.focus?.();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (current === first || !trap.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !trap.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [active, initialFocusRef]);

  return containerRef;
}
