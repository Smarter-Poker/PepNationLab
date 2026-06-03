'use client';

import { useState } from 'react';
import DynamicCalculatorHero from './DynamicCalculatorHero';
import CalculatorSuite from './CalculatorSuite';

export default function CalculatorsClient() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <>
      <DynamicCalculatorHero onSelect={setActiveId} />
      <CalculatorSuite activeId={activeId} />
    </>
  );
}
