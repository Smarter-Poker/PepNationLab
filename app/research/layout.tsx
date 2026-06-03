import React from 'react';
import Navbar from '@/components/Navbar';

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div style={{ paddingTop: '60px', minHeight: '100vh', backgroundColor: '#05070a' }}>
        {children}
      </div>
    </>
  );
}
