'use client';
import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';

/**
 * House/admin store free-shipping promo. Shows only on the house storefront
 * (researchstore). The offer is enforced server-side in /api/orders and the
 * checkout summary reflects $0 shipping once the $100 threshold is met.
 */
export default function FreeShippingBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(window.location.pathname === '/researchstore'); }, []);
  if (!show) return null;
  return (
    <div role="status" data-nosnippet style={{ background: 'linear-gradient(90deg,#0A1018 0%,#12303a 100%)', color: '#EAF7F6', padding: '7px 16px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #143b44' }}>
      <Truck size={15} aria-hidden="true" />
      <span>Free Shipping On All Orders $100+</span>
    </div>
  );
}
