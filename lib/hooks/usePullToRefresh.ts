import { useState, useRef, useEffect } from 'react';
import { haptic } from '../haptic';

type PullState = 'idle' | 'pulling' | 'refreshing';

export function usePullToRefresh(onRefresh: () => Promise<void>, threshold: number = 60) {
    const [pullState, setPullState] = useState<PullState>('idle');
    const pullStartY = useRef(0);
    const pullStateRef = useRef<PullState>(pullState);

    // Keep ref in sync
    useEffect(() => {
        pullStateRef.current = pullState;
    }, [pullState]);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            if (window.scrollY < 10) {
                pullStartY.current = e.touches[0].clientY;
            } else {
                pullStartY.current = 0;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (pullStartY.current === 0) return;
            const dy = e.touches[0].clientY - pullStartY.current;
            
            if (dy > threshold && pullStateRef.current === 'idle') {
                haptic(15);
                setPullState('pulling');
            }
        };

        const handleTouchEnd = () => {
            if (pullStateRef.current === 'pulling') {
                setPullState('refreshing');
                haptic(20);
                onRefresh().finally(() => {
                    setPullState('idle');
                });
            }
            pullStartY.current = 0;
        };

        // Passive listeners are crucial for scroll performance
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onRefresh, threshold]);

    return { pullState };
}
