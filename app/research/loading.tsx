import PageLoader from '@/components/PageLoader';

export default function Loading() {
  return (
    <PageLoader 
      open={true} 
      title="Accessing Library" 
      subtitle="Connecting to Pep Nation Lab's research database..." 
    />
  );
}
