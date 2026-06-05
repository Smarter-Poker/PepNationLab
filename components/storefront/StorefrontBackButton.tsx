'use client';

import { useRouter } from 'next/navigation';

export default function StorefrontBackButton() {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard');
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
      <img src="/back-arrow.png" width={42} height={42} alt="Back" style={{ objectFit: 'contain' }} />
    </button>
  );
}
