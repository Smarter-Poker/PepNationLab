/**
 * Triggers a micro-vibration on supported mobile devices.
 * Used to provide haptic feedback for critical actions (e.g., adding to cart, saving).
 * Fails silently on devices that don't support it (iOS Safari, Desktop).
 */
export const vibrate = (pattern: number | number[] = 50) => {
  if (typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore if browser restricts it
    }
  }
};
