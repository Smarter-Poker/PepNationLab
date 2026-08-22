'use client';

/**
 * A11y: makes every framer-motion animation in the tree honor the user's
 * OS-level reduced-motion preference (WCAG 2.2.2 / 2.3.3). The CSS
 * prefers-reduced-motion reset in globals.css cannot reach JS-driven
 * inline transforms, so this is the systemic fix for framer-motion.
 */

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
