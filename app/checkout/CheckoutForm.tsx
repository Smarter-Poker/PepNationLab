'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/CartContext';
import CartWarnings from '@/components/research/CartWarnings';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { US_STATES } from '@/lib/us-states';
import PaymentProofUpload from '@/components/PaymentProofUpload';
import { toTitleCase } from '@/lib/categoryImage';
import { createClient } from '@/lib/supabase/client';
import { calculateShippingCost as getShippingCost, ShippingOption } from '@/lib/shipping';
import AddressAutocompleteInput from '@/components/AddressAutocompleteInput';

type PaymentMethodId = 'zelle' | 'cashapp' | 'venmo' | 'apple_pay' | 'apple_cash';

const baseStyle = { height: 28, width: 'auto', objectFit: 'contain' as const };
const scaleStyle = (scale: number) => ({ ...baseStyle, transform: `scale(${scale})` });

const ALL_PAYMENT_METHODS: { id: PaymentMethodId; name: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'zelle',      name: 'Zelle',      desc: 'Instant Direct Transfer. Fastest Processing.', icon: <Image src="/payment-logos/zelle.svg" width={40} height={28} alt="Zelle" unoptimized style={baseStyle} /> },
  { id: 'cashapp',    name: 'Cash App',   desc: 'Secure Mobile Check. Handled Manually.', icon: <Image src="/payment-logos/cashapp.svg" width={40} height={28} alt="Cash App" unoptimized style={baseStyle} /> },
  { id: 'venmo',      name: 'Venmo',      desc: 'Social Transfer. Manual Clearance.', icon: <Image src="/payment-logos/venmo.svg" width={40} height={28} alt="Venmo" unoptimized style={scaleStyle(1.4)} /> },
  { id: 'apple_pay',  name: 'Apple Pay',  desc: 'Tap To Pay. Instant Mobile Checkout.', icon: <Image src="/payment-logos/apple_cash.svg" width={40} height={28} alt="Apple Pay" unoptimized style={scaleStyle(1.4)} /> },
  { id: 'apple_cash', name: 'Apple Cash', desc: 'Secure Contactless Flow. Fast Settlement.', icon: <Image src="/payment-logos/apple_cash.svg" width={40} height={28} alt="Apple Cash" unoptimized style={scaleStyle(1.4)} /> },
];
