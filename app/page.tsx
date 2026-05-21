'use client';

import { useState, useEffect } from 'react';
import DisclaimerGate from '@/components/DisclaimerGate';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import ProductsPreview from '@/components/ProductsPreview';
import HowItWorksSection from '@/components/HowItWorksSection';
import FooterSection from '@/components/FooterSection';

export default function HomePage() {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accepted = localStorage.getItem('pnl_disclaimer_v1');
    if (accepted === 'true') setDisclaimerAccepted(true);
    setLoading(false);
  }, []);

  const handleDisclaimerAccept = () => {
    localStorage.setItem('pnl_disclaimer_v1', 'true');
    setDisclaimerAccepted(true);
    // In production: also POST to /api/disclaimer-log with session info
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--black)' 
      }}>
        <div className="animate-pulse-teal" style={{
          width: 60, height: 60, borderRadius: '50%',
          border: '3px solid var(--teal)',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!disclaimerAccepted) {
    return <DisclaimerGate onAccept={handleDisclaimerAccept} />;
  }

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
