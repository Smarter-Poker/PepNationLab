'use client';

import React, { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { vibrateLight, initHaptics } from '@/lib/messenger/haptics';

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  // Global haptics for all clickables in the Research section
  useEffect(() => {
    const handleInit = () => initHaptics();
    window.addEventListener('pointerdown', handleInit, { once: true });

    const handlePointerDown = (e: PointerEvent) => {
      // Traverse up to find if we clicked an anchor or button
      let target = e.target as HTMLElement | null;
      while (target && target !== document.body) {
        if (
          target.tagName === 'A' || 
          target.tagName === 'BUTTON' ||
          target.getAttribute('role') === 'button' ||
          target.classList.contains('hotspot') ||
          target.classList.contains('search-btn')
        ) {
          vibrateLight();
          break;
        }
        target = target.parentElement;
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handleInit);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <>
      <Navbar />
      <div style={{ paddingTop: '60px', minHeight: '100vh', backgroundColor: '#05070a' }}>
        {children}
      </div>
    </>
  );
}
