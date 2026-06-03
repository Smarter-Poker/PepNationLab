'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DynamicCalculatorHero() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 1024, aspectRatio: '1024/564', margin: '0 auto 40px' }}>
      <Image 
        src="/images/researcher_calculators_hero.png" 
        alt="Researcher Calculators Dashboard" 
        fill 
        style={{ objectFit: 'contain' }}
        priority
      />

      {/* Back Button */}
      <Link 
        href="/research"
        aria-label="Back To Research Library"
        style={{ position: 'absolute', top: '17%', right: '5%', width: '25%', height: '10%', zIndex: 10 }}
      />

      {/* Search Bar */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            router.push(`/research/search?q=${encodeURIComponent(query.trim())}`);
          }
        }}
        style={{ position: 'absolute', top: '30%', left: '8%', right: '8%', height: '9.5%', zIndex: 10 }}
      >
        <input 
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
          style={{ 
            width: '100%', 
            height: '100%', 
            background: 'transparent', 
            border: 'none', 
            color: '#fff', 
            fontSize: '1rem', 
            outline: 'none',
            padding: '0 10px'
          }}
        />
      </form>

      {/* Grid Overlay */}
      <div style={{ 
        position: 'absolute', 
        top: '45.2%', 
        bottom: '6.1%', 
        left: '5.8%', 
        right: '5.9%', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(6, 1fr)', 
        gridTemplateRows: 'repeat(2, 1fr)', 
        columnGap: '1.5%',
        rowGap: '6%',
        zIndex: 10
      }}>
        <Link href="#reconstitution" aria-label="Reconstitution" />
        <Link href="#dilution" aria-label="Serial Dilution" />
        <Link href="#concentration" aria-label="Concentration Converter" />
        <Link href="#stability" aria-label="Arrhenius Stability" />
        <Link href="#cost" aria-label="Cost Per Dose" />
        <Link href="#pooling" aria-label="Vial Pooling" />
        
        <Link href="#hplc-rt" aria-label="HPLC RT Predictor" />
        <Link href="#mass-spec" aria-label="Mass Spec m/z" />
        <Link href="#spps-cost" aria-label="Fmoc-SPPS Cost" />
        <Link href="#solubility" aria-label="Solubility Predictor" />
        <Link href="#vial-quantity" aria-label="Vial Quantity Power" />
        <div /> {/* Empty 6th slot */}
      </div>
    </div>
  );
}
