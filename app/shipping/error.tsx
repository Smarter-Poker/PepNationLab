'use client';

import SegmentError from '@/components/SegmentError';

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SegmentError {...props} boundary="app/shipping/error.tsx" />;
}
