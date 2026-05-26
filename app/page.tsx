import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import ProductsPreview from '@/components/ProductsPreview';
import HowItWorksSection from '@/components/HowItWorksSection';
import FooterSection from '@/components/FooterSection';

// Layer 1 (Site Entry disclaimer) is handled globally by SiteDisclaimerGate
// in app/layout.tsx, so it covers every route — not just this homepage.
export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="page-top-padding">
        <HeroSection />
        <ProductsPreview />
        <HowItWorksSection />
        <FooterSection />
      </main>
    </>
  );
}
