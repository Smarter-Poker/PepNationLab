'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function StorefrontBackButton({ dashLink }: { dashLink?: string }) {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#store') {
        router.back();
      } else {
        router.push(dashLink || '/dashboard');
      }
    }
  };

  return (
    <button
      onClick={handleBack}
      className="sf-nav-back"
      aria-label="Go Back"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Image src="/back-arrow.png" alt="Back" width={42} height={42} unoptimized style={{ objectFit: 'contain' }} />
    </button>
  );
}
