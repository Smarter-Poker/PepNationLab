import PageLoader from '@/components/PageLoader';

export default function Loading() {
  return (
    <PageLoader 
      open={true} 
      title="Accessing Storefront" 
      subtitle="Pep Nation Lab is retrieving live inventory and pricing..." 
    />
  );
}
