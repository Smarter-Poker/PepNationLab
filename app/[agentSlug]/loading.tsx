import StorefrontSkeleton from '@/components/StorefrontSkeleton';

export default function Loading() {
  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: 68 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 8px' }}>
        <StorefrontSkeleton />
      </div>
    </div>
  );
}
