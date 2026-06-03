'use client';

import { useState, useEffect } from 'react';
import DynamicCalculatorHero from './DynamicCalculatorHero';
import CalculatorSuite from './CalculatorSuite';

export default function CalculatorsClient() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setActiveId(hash);
      }
    };

    // Run once on mount
    onHashChange();

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleSelect = (id: string) => {
    setActiveId(id);
    window.location.hash = id;
    
    // Slight delay to allow React to render the suite section, then scroll
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  return (
    <>
      <DynamicCalculatorHero onSelect={handleSelect} />
      <CalculatorSuite activeId={activeId} />
    </>
  );
}
