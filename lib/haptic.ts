/**
 * Military-grade haptic feedback utility for mobile web apps.
 * Triggers the device's vibration motor to simulate native app feel.
 * Defaults to a 10ms light tap. 
 * Use 5ms for minor clicks, 15ms for success actions, 20ms for heavy actions.
 */
export const haptic = (ms: number = 10) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            navigator.vibrate(ms);
        } catch (e) {
            // Silently fail if vibrate isn't allowed (e.g., cross-origin iframes without permission)
        }
    }
};
