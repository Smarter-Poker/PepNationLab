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

type PaymentMethodId = 'zelle' | 'cashapp' | 'venmo' | 'apple_cash';

const baseStyle = { height: 28, width: 'auto', objectFit: 'contain' as const };
const scaleStyle = (scale: number) => ({ ...baseStyle, transform: `scale(${scale})` });

const ALL_PAYMENT_METHODS: { id: PaymentMethodId; name: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'zelle',      name: 'Zelle',      desc: 'Instant Direct Transfer. Fastest Processing.', icon: <Image src="/payment-logos/zelle.svg" width={40} height={28} alt="Zelle" unoptimized style={baseStyle} /> },
  { id: 'cashapp',    name: 'Cash App',   desc: 'Secure Mobile Check. Handled Manually.', icon: <Image src="/payment-logos/cashapp.svg" width={40} height={28} alt="Cash App" unoptimized style={baseStyle} /> },
  { id: 'venmo',      name: 'Venmo',      desc: 'Social Transfer. Manual Clearance.', icon: <Image src="/payment-logos/venmo.svg" width={40} height={28} alt="Venmo" unoptimized style={scaleStyle(1.4)} /> },
  { id: 'apple_cash', name: 'Apple Cash', desc: 'Secure Contactless Flow. Fast Settlement.', icon: <Image src="/payment-logos/apple_cash.svg" width={40} height={28} alt="Apple Cash" unoptimized style={scaleStyle(1.4)} /> },
];

interface Profile {
  full_name: string | null;
  role: string;
  tier: string | null;
  referring_agent_id: string | null;
  is_sub_agent?: boolean | null;
}

interface CheckoutFormProps {
  userProfile: Profile;
  userEmail: string;
  tierMultipliers: Record<string, number>;
  /** Which agent storefront initiated this checkout - enforces closed-loop isolation */
  agentSlug?: string | null;
  /** Payment handles configured by the agent (from agent_profiles.payment_handles) */
  agentPaymentHandles?: Record<string, string>;
  /** Overall minimum items required to checkout from this agent */
  minOverallQty?: number;
  minOrderQty?: number;
}

interface SavedAddress {
  id: string;
  label: string | null;
  full_name: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default: boolean;
}

export default function CheckoutForm({ userProfile, userEmail, tierMultipliers, agentSlug, agentPaymentHandles, minOverallQty = 1, minOrderQty = 1 }: CheckoutFormProps) {
  // Agent buying from their own store -> show tier-discounted pricing.
  // Cross-check: only treat as self-buy when the agentSlug in the URL
  // matches the agent's OWN store. If an agent visits another agent's
  // storefront, isAgentSelfBuy must be false so UI/rules are correct.
  // We start with the role check and refine via agentSlug match below.
  const isAgentByRole = userProfile.role === 'agent' || userProfile.role === 'super_agent';
  // SACA: sub-agents have role='agent' but pay PARENT'S RETAIL on self-buy
  // (commission credited weekly, no checkout discount). They must NOT be
  // treated as agent self-buy or the UI would show a fake wholesale discount,
  // the 10-vial minimum would block legitimate small orders, and the coupon
  // UI gating would mis-label them as "Agent Direct Subtotal".
  const isSubAgent = userProfile.is_sub_agent === true;
  // Admins are intentionally excluded: they don't have agent_profiles rows.
  const isAgentSelfBuy = isAgentByRole && !isSubAgent;
  // Coupons are blocked both for legit agent self-buys AND for sub-agents
  // (sub-agents earn commission as digital credits weekly - no checkout stack).
  const couponDisabled = isAgentSelfBuy || isSubAgent;

  // Derive available payment methods from what the agent has actually configured.
  // If agentPaymentHandles has no non-empty values, fall back to all methods.
  const availablePaymentMethods = (
    agentPaymentHandles &&
    Object.values(agentPaymentHandles).some(v => typeof v === 'string' && v.trim().length > 0)
  )
    ? ALL_PAYMENT_METHODS.filter(p => {
        const h = agentPaymentHandles[p.id];
        return typeof h === 'string' && h.trim().length > 0;
      })
    : ALL_PAYMENT_METHODS;
  const { cart: contextCart, cartSubtotal: contextSubtotal, clearCart } = useCart();
  const router = useRouter();

  // The per-agent cart key - ONLY reads this agent's cart, never another agent's.
  // If no agentSlug (admin/direct checkout), reads legacy global key as fallback.
  const storefrontCartKey = agentSlug
    ? `pnl_storefront_cart_${agentSlug}`
    : 'pnl_storefront_cart';

  // Storefront orders written by AgentStorefrontGrid - bypass CartContext refresh
  // (which validates agent_product ids, not master product ids).
  const [storefrontCart, setStorefrontCart] = useState<Array<{
    id: string; name: string; sku: string; quantity: number;
    retailPrice: number; costPrice: number; weightOz: number;
    bundleName?: string; bulkCostPrice?: number | null; bulkThreshold?: number;
  }>>([]);
  const [storefrontLoaded, setStorefrontLoaded] = useState(false);
  // Cart staleness: populated from the _savedAt timestamp written by AgentStorefrontGrid.
  const [cartSavedAt, setCartSavedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storefrontCartKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // New format: { items: [...], _savedAt: timestamp }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.items)) {
          if (parsed.items.length > 0) setStorefrontCart(parsed.items);
          if (typeof parsed._savedAt === 'number') setCartSavedAt(parsed._savedAt);
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          // Legacy format: plain array (no timestamp - treat as not stale to avoid false warnings)
          setStorefrontCart(parsed);
        }
      }
    } catch { /* non-blocking */ }
    setStorefrontLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use storefront cart if present, otherwise fall back to CartContext
  const cart = storefrontCart.length > 0 ? storefrontCart : contextCart;
  const totalCartQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const meetsOverallMin = totalCartQty >= minOverallQty;

  const cartSubtotal = storefrontCart.length > 0
    ? storefrontCart.reduce((sum, item) => sum + (item.bundleName ? item.costPrice * 0.9 : item.costPrice) * item.quantity, 0)
    : contextSubtotal;

  // Agent Direct Pricing Discount = difference between public retail and their tier cost
  const agentPricingDiscount = isAgentSelfBuy && storefrontCart.length > 0
    ? storefrontCart.reduce((sum, item) => {
        const retail = item.retailPrice ?? item.costPrice;
        const discountMultiplier = item.bundleName ? 0.9 : 1;
        return sum + Math.max(0, (retail * discountMultiplier) - (item.costPrice * discountMultiplier)) * item.quantity;
      }, 0)
    : 0;

  const clearAllCarts = () => {
    clearCart();
    try { localStorage.removeItem(storefrontCartKey); } catch { /* ok */ }
    try { if (agentSlug) localStorage.removeItem(`cart_${agentSlug}`); } catch { /* ok */ }
    setStorefrontCart([]);
  };

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [totalAdjusted, setTotalAdjusted] = useState(false);

  const cartIsStale = cartSavedAt !== null && (Date.now() - cartSavedAt) > 24 * 60 * 60 * 1000;

  const idempotencyKeyRef = useRef<string | null>(null);
  const submittedRef = useRef<boolean>(false);

  const [liveShippingRate, setLiveShippingRate] = useState<number | null>(null);
  const shippingFetchAbortRef = useRef<AbortController | null>(null);


  const getIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    return idempotencyKeyRef.current;
  };

  const resetIdempotencyKey = () => {
    idempotencyKeyRef.current = null;
  };

  const [bacProduct, setBacProduct] = useState<{
    id: string;
    agentProductId: string;
    name: string;
    retailPrice: number;
    costPrice: number;
    weightOz: number;
    unitSize: string | null;
    unitMeasure: string | null;
  } | null>(null);

  const [aceticProduct, setAceticProduct] = useState<{
    id: string;
    agentProductId: string;
    name: string;
    retailPrice: number;
    costPrice: number;
    weightOz: number;
    unitSize: string | null;
    unitMeasure: string | null;
  } | null>(null);

  // Load Bacteriostatic Water and Acetic Acid product details on mount
  useEffect(() => {
    (async () => {
      try {
        if (!agentSlug) {
          const supabase = createClient();
          const { data: p } = await supabase
            .from('products')
            .select('id, name, base_cost, weight_oz, unit_size, unit_measure')
            .eq('compound_slug', 'bac-water')
            .limit(1)
            .maybeSingle();
          if (p) {
            const basePrice = Number(p.base_cost) || 12.00;
            const sizeLabel = p.unit_size ? `(${p.unit_size}${p.unit_measure || ''})` : '';
            setBacProduct({
              id: p.id,
              agentProductId: p.id,
              name: `${p.name} ${sizeLabel}`.trim(),
              retailPrice: basePrice,
              costPrice: basePrice,
              weightOz: Number(p.weight_oz) || 0.5,
              unitSize: p.unit_size ?? null,
              unitMeasure: p.unit_measure ?? null,
            });
          }

          const { data: pAcetic } = await supabase
            .from('products')
            .select('id, name, base_cost, weight_oz, unit_size, unit_measure')
            .ilike('name', '%acetic acid%')
            .limit(1)
            .maybeSingle();
          if (pAcetic) {
            const basePrice = Number(pAcetic.base_cost) || 15.00;
            const sizeLabel = pAcetic.unit_size ? `(${pAcetic.unit_size}${pAcetic.unit_measure || ''})` : '';
            setAceticProduct({
              id: pAcetic.id,
              agentProductId: pAcetic.id,
              name: `${pAcetic.name} ${sizeLabel}`.trim(),
              retailPrice: basePrice,
              costPrice: basePrice,
              weightOz: Number(pAcetic.weight_oz) || 0.5,
              unitSize: pAcetic.unit_size ?? null,
              unitMeasure: pAcetic.unit_measure ?? null,
            });
          }
          return;
        }

        if (isAgentSelfBuy) {
          const res = await fetch('/api/agent/products');
          if (res.ok) {
            const json = await res.json();
            const items = json.data || [];
            
            const matched = items.find((item: any) => item.products?.compound_slug === 'bac-water');
            if (matched) {
              const retail = matched.retail_price / 10;
              const cost = matched.agent_cost != null ? matched.agent_cost / 10 : retail;
              const sizeLabel = matched.products?.unit_size
                ? `(${matched.products.unit_size}${matched.products.unit_measure || ''})`
                : '';
              setBacProduct({
                id: matched.product_id,
                agentProductId: matched.id,
                name: `${matched.products?.name || 'Bac. Water'} ${sizeLabel}`.trim(),
                retailPrice: retail,
                costPrice: cost,
                weightOz: Number(matched.products?.weight_oz) || 0.5,
                unitSize: matched.products?.unit_size ?? null,
                unitMeasure: matched.products?.unit_measure ?? null,
              });
            }

            const matchedAcetic = items.find((item: any) => (item.products?.name || '').toLowerCase().includes('acetic acid'));
            if (matchedAcetic) {
              const retail = matchedAcetic.retail_price / 10;
              const cost = matchedAcetic.agent_cost != null ? matchedAcetic.agent_cost / 10 : retail;
              const sizeLabel = matchedAcetic.products?.unit_size
                ? `(${matchedAcetic.products.unit_size}${matchedAcetic.products.unit_measure || ''})`
                : '';
              setAceticProduct({
                id: matchedAcetic.product_id,
                agentProductId: matchedAcetic.id,
                name: `${matchedAcetic.products?.name || 'Acetic Acid'} ${sizeLabel}`.trim(),
                retailPrice: retail,
                costPrice: cost,
                weightOz: Number(matchedAcetic.products?.weight_oz) || 0.5,
                unitSize: matchedAcetic.products?.unit_size ?? null,
                unitMeasure: matchedAcetic.products?.unit_measure ?? null,
              });
            }
            return;
          }
        }

        const supabase = createClient();
        const { data: agentProfile } = await supabase
          .from('agent_profiles')
          .select('id')
          .ilike('slug', agentSlug)
          .maybeSingle();

        if (agentProfile) {
          const { data: ap } = await supabase
            .from('agent_products')
            .select(`
              id,
              product_id,
              retail_price,
              products!inner (
                name,
                unit_size,
                unit_measure,
                weight_oz,
                compound_slug
              )
            `)
            .eq('agent_id', agentProfile.id)
            .eq('is_visible', true)
            .eq('products.compound_slug', 'bac-water')
            .limit(1)
            .maybeSingle();

          if (ap) {
            const retail = ap.retail_price / 10;
            const prod = (Array.isArray(ap.products) ? ap.products[0] : ap.products) as any;
            const sizeLabel = prod?.unit_size
              ? `(${prod.unit_size}${prod.unit_measure || ''})`
              : '';
            setBacProduct({
              id: ap.product_id,
              agentProductId: ap.id,
              name: `${prod?.name || 'Bac. Water'} ${sizeLabel}`.trim(),
              retailPrice: retail,
              costPrice: retail,
              weightOz: Number(prod?.weight_oz) || 0.5,
              unitSize: prod?.unit_size ?? null,
              unitMeasure: prod?.unit_measure ?? null,
            });
          }

          const { data: apAcetic } = await supabase
            .from('agent_products')
            .select(`
              id,
              product_id,
              retail_price,
              products!inner (
                name,
                unit_size,
                unit_measure,
                weight_oz,
                compound_slug
              )
            `)
            .eq('agent_id', agentProfile.id)
            .eq('is_visible', true)
            .ilike('products.name', '%acetic acid%')
            .limit(1)
            .maybeSingle();

          if (apAcetic) {
            const retail = apAcetic.retail_price / 10;
            const prod = (Array.isArray(apAcetic.products) ? apAcetic.products[0] : apAcetic.products) as any;
            const sizeLabel = prod?.unit_size
              ? `(${prod.unit_size}${prod.unit_measure || ''})`
              : '';
            setAceticProduct({
              id: apAcetic.product_id,
              agentProductId: apAcetic.id,
              name: `${prod?.name || 'Acetic Acid'} ${sizeLabel}`.trim(),
              retailPrice: retail,
              costPrice: retail,
              weightOz: Number(prod?.weight_oz) || 0.5,
              unitSize: prod?.unit_size ?? null,
              unitMeasure: prod?.unit_measure ?? null,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching reconstitution products:', err);
      }
    })();
  }, [agentSlug, isAgentSelfBuy]);

  const [fullName, setFullName] = useState(userProfile.full_name ?? '');
  const [street, setStreet] = useState('');
  const [suite, setSuite] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');

  const [fulfillmentMethod, setFulfillmentMethod] = useState<'ship' | 'agent_pickup'>('agent_pickup');
  const [shippingOption, setShippingOption] = useState<ShippingOption>('agent_pickup');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(availablePaymentMethods[0]?.id ?? 'zelle');

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [saveAddress, setSaveAddress] = useState<boolean>(true);
  const [savedAddressesLoading, setSavedAddressesLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/researcher/addresses');
        const json = await res.json();
        if (cancelled || !res.ok) return;
        const list: SavedAddress[] = json.data || [];
        setSavedAddresses(list);
        const def = list.find((a) => a.is_default) || list[0];
        if (def) {
          setSelectedAddressId(def.id);
          setFullName(def.full_name);
          setStreet(def.street1);
          setSuite(def.street2 || '');
          setCity(def.city);
          setState(def.state);
          setZip(def.zip);
          setSaveAddress(false);
        }
      } catch {
      } finally {
        if (!cancelled) setSavedAddressesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickSavedAddress(id: string) {
    setSelectedAddressId(id);
    if (id === 'new') {
      setFullName(userProfile.full_name ?? '');
      setStreet('');
      setSuite('');
      setCity('');
      setState('');
      setZip('');
      setSaveAddress(true);
      return;
    }
    const a = savedAddresses.find((x) => x.id === id);
    if (!a) return;
    setFullName(a.full_name);
    setStreet(a.street1);
    setSuite(a.street2 || '');
    setCity(a.city);
    setState(a.state);
    setZip(a.zip);
    setSaveAddress(false);
  }

  const [disclaimer1, setDisclaimer1] = useState(false);
  const [disclaimer2, setDisclaimer2] = useState(false);
  const [disclaimer3, setDisclaimer3] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);




  const ACETIC_ACID_SLUGS = /\b(igf[-_\s]?1[-_\s]?(lr3|des|des-1-3)|aod[-_\s]?9604|ghk[-_\s]?cu|ghrp[-_\s]?[26]|fragment[-_\s]?(176|hgh[-_\s]?frag)|melanotan[-_\s]?[i12]|epital[o]?n|epithalon|nad\+?)\b/i;

  const isDiluentName = (name: string | null | undefined) => {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower.includes('bac water') || 
           lower.includes('bacteriostatic water') || 
           lower.includes('bac. water') || 
           lower.includes('acetic acid');
  };

  const aceticPeptideVials = cart.reduce((sum, item) => {
    if (isDiluentName(item.name)) return sum;
    const isAcetic = ACETIC_ACID_SLUGS.test(item.name) || (item.sku && ACETIC_ACID_SLUGS.test(item.sku));
    if (!isAcetic) return sum;
    let vialsPerUnit = 1;
    if (item.name.includes('+')) {
      vialsPerUnit = item.name.split('+').length;
    }
    return sum + (vialsPerUnit * item.quantity);
  }, 0);

  const bacPeptideVials = cart.reduce((sum, item) => {
    if (isDiluentName(item.name)) return sum;
    const isAcetic = ACETIC_ACID_SLUGS.test(item.name) || (item.sku && ACETIC_ACID_SLUGS.test(item.sku));
    if (isAcetic) return sum;
    let vialsPerUnit = 1;
    if (item.name.includes('+')) {
      vialsPerUnit = item.name.split('+').length;
    }
    return sum + (vialsPerUnit * item.quantity);
  }, 0);

  const currentBacWaterVials = cart.reduce((sum, item) => {
    const lower = (item.name || '').toLowerCase();
    if (lower.includes('bac water') || lower.includes('bacteriostatic water') || lower.includes('bac. water')) {
      return sum + item.quantity;
    }
    return sum;
  }, 0);

  const currentAceticAcidVials = cart.reduce((sum, item) => {
    const lower = (item.name || '').toLowerCase();
    if (lower.includes('acetic acid')) {
      return sum + item.quantity;
    }
    return sum;
  }, 0);

  const requiredBacWaterVials = bacPeptideVials > 0 ? Math.ceil(bacPeptideVials / 10) * 10 : 0;
  const neededBacWaterVials = Math.max(0, requiredBacWaterVials - currentBacWaterVials);

  const requiredAceticAcidVials = aceticPeptideVials > 0 ? Math.ceil(aceticPeptideVials / 10) * 10 : 0;
  const neededAceticAcidVials = Math.max(0, requiredAceticAcidVials - currentAceticAcidVials);

  const handleAddBacWater = () => {
    if (!bacProduct || neededBacWaterVials <= 0) return;
    
    const updatedCart = [...storefrontCart];
    const existingIndex = updatedCart.findIndex(item => item.id === bacProduct.id);
    const suggestedQty = neededBacWaterVials;
    
    if (existingIndex > -1) {
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: updatedCart[existingIndex].quantity + suggestedQty
      };
    } else {
      updatedCart.push({
        id: bacProduct.id,
        name: bacProduct.name,
        sku: bacProduct.id,
        quantity: suggestedQty,
        retailPrice: bacProduct.retailPrice,
        costPrice: bacProduct.costPrice,
        weightOz: bacProduct.weightOz
      });
    }
    
    try {
      localStorage.setItem(storefrontCartKey, JSON.stringify({
        items: updatedCart,
        _savedAt: Date.now()
      }));
      
      if (agentSlug) {
        const rawCart = localStorage.getItem(`cart_${agentSlug}`);
        const cartItemsObj = rawCart ? JSON.parse(rawCart) : {};
        const agentProdId = bacProduct.agentProductId;
        cartItemsObj[agentProdId] = (cartItemsObj[agentProdId] || 0) + suggestedQty;
        localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(cartItemsObj));
      }
    } catch (e) {
      console.error('Failed to update cart storage:', e);
    }
    
    setStorefrontCart(updatedCart);
  };

  const handleAddAceticAcid = () => {
    if (!aceticProduct || neededAceticAcidVials <= 0) return;
    
    const updatedCart = [...storefrontCart];
    const existingIndex = updatedCart.findIndex(item => item.id === aceticProduct.id);
    const suggestedQty = neededAceticAcidVials;
    
    if (existingIndex > -1) {
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: updatedCart[existingIndex].quantity + suggestedQty
      };
    } else {
      updatedCart.push({
        id: aceticProduct.id,
        name: aceticProduct.name,
        sku: aceticProduct.id,
        quantity: suggestedQty,
        retailPrice: aceticProduct.retailPrice,
        costPrice: aceticProduct.costPrice,
        weightOz: aceticProduct.weightOz
      });
    }
    
    try {
      localStorage.setItem(storefrontCartKey, JSON.stringify({
        items: updatedCart,
        _savedAt: Date.now()
      }));
      
      if (agentSlug) {
        const rawCart = localStorage.getItem(`cart_${agentSlug}`);
        const cartItemsObj = rawCart ? JSON.parse(rawCart) : {};
        const agentProdId = aceticProduct.agentProductId;
        cartItemsObj[agentProdId] = (cartItemsObj[agentProdId] || 0) + suggestedQty;
        localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(cartItemsObj));
      }
    } catch (e) {
      console.error('Failed to update cart storage:', e);
    }
    
    setStorefrontCart(updatedCart);
  };

  const totalWeightOz = cart.reduce((acc, item) => acc + (item.weightOz ?? 0.5) * item.quantity, 0);

  useEffect(() => {
    if (shippingFetchAbortRef.current) shippingFetchAbortRef.current.abort();
    const ctrl = new AbortController();
    shippingFetchAbortRef.current = ctrl;
    if (shippingOption === 'agent_pickup') {
      setLiveShippingRate(0);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/shipping-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weightOz: totalWeightOz, shippingOption }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        setLiveShippingRate(Number(json.rate) || 0);
      } catch {
        const fallback = getShippingCost(shippingOption, totalWeightOz);
        setLiveShippingRate(fallback);
      }
    })();
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWeightOz, shippingOption]);

  // Auto-apply ?coupon= from a marketing link (set by CouponLinkCapture
  // on the agent storefront). Fires once when the form is mounted in an
  // eligible state (not an agent self-buy / sub-agent), then clears the
  // stash so a manual change can't be overridden by stale data.
  const couponAutoAppliedRef = useRef(false);
  useEffect(() => {
    if (couponAutoAppliedRef.current) return;
    if (couponDisabled) return;
    try {
      const raw = window.localStorage.getItem('pnl_pending_coupon');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code?: string; savedAt?: number };
      const stashed = (parsed?.code ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
      if (!/^[A-Z0-9-]{3,24}$/.test(stashed)) {
        window.localStorage.removeItem('pnl_pending_coupon');
        return;
      }
      couponAutoAppliedRef.current = true;
      setCouponInput(stashed);
      window.localStorage.removeItem('pnl_pending_coupon');
      setTimeout(() => {
        try { applyCoupon(); } catch { /* applyCoupon may throw if cart empty */ }
      }, 50);
    } catch {
      // Storage unavailable or malformed; ignore.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponDisabled, cartSubtotal]);

  if (!storefrontLoaded) return null;

  const calculateShippingCost = () => {
    if (shippingOption === 'agent_pickup') return 0;
    if (liveShippingRate !== null) return liveShippingRate;
    return getShippingCost(shippingOption, totalWeightOz);
  };

  const shippingCost = calculateShippingCost();
  const discount = appliedCoupon?.discount ?? 0;
  const subtotalAfterDiscount = Math.max(0, cartSubtotal - discount) + shippingCost;

  const grandTotal = Math.max(0, subtotalAfterDiscount);

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      if (!meetsOverallMin) {
        setError(`This storefront requires a minimum overall order of ${minOverallQty} items. Please add more items to proceed.`);
        return;
      }
      
      const violatingItem = cart.find(item => item.quantity < minOrderQty);
      if (violatingItem) {
        setError(`This storefront requires a minimum of ${minOrderQty} per peptide. "${violatingItem.name}" has only ${violatingItem.quantity}.`);
        return;
      }
      if (fulfillmentMethod === 'ship') {
        if (!fullName.trim() || !street.trim() || !city.trim() || !state.trim() || !zip.trim()) {
          setError('All Shipping Fields Are Required For Delivery.');
          return;
        }
        const digitsOnly = phone.replace(/\D/g, '');
        if (phone.trim() && digitsOnly.length < 10) {
          setError('Please Enter A Valid 10-Digit Phone Number For Shipping Updates.');
          return;
        }
        if (!/^\d{5}(-\d{4})?$/.test(zip.trim())) {
          setError('Please Enter A Valid 5-Digit ZIP Code.');
          return;
        }
      }
      const overLimit = cart.find(item => item.quantity > 10_000);
      if (overLimit) {
        setError(`Quantity for "${overLimit.name}" exceeds the maximum allowed (10,000 per item). Please reduce the quantity.`);
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setError(null);
    setStep(prev => prev - 1);
  };

  const applyCoupon = async () => {
    setCouponError('');
    const code = couponInput.trim();
    if (!code) {
      setCouponError('Enter A Coupon Code.');
      return;
    }
    setCouponLoading(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: cartSubtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedCoupon({ code: data.code, discount: Number(data.discount) || 0 });
        setCouponError('');
      } else {
        setAppliedCoupon(null);
        setCouponError(data.error ?? 'That Coupon Is Not Valid.');
      }
    } catch {
      setCouponError('Could Not Verify Coupon. Please Try Again.');
    } finally {
      setCouponLoading(false);
    }
  };



  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!disclaimer1 || !disclaimer2 || !disclaimer3) {
      setError('You Must Acknowledge All Lab Research Terms Prior To Placing Order.');
      return;
    }

    if (isAgentSelfBuy) {
      const belowMin = cart.find(item => item.quantity < 10);
      if (belowMin) {
        setError(`Agent Direct Pricing Requires A Minimum Of 10 Vials Per Item. "${belowMin.name}" Has Only ${belowMin.quantity}. Please Update Your Cart.`);
        return;
      }
    }

    if (!meetsOverallMin) {
      setError(`This storefront requires a minimum overall order of ${minOverallQty} items. Please add more items to proceed.`);
      return;
    }
    const violatingItem = cart.find(item => item.quantity < minOrderQty);
    if (violatingItem) {
      setError(`This storefront requires a minimum of ${minOrderQty} per peptide. "${violatingItem.name}" has only ${violatingItem.quantity}.`);
      return;
    }
    const overLimit = cart.find(item => item.quantity > 10_000);
    if (overLimit) {
      setError(`Quantity for "${overLimit.name}" exceeds the maximum allowed (10,000 per item). Please reduce the quantity.`);
      return;
    }

    if (submittedRef.current) return;
    submittedRef.current = true;

    setLoading(true);

    try {
      if (
        fulfillmentMethod === 'ship'
        && selectedAddressId === 'new'
        && saveAddress
        && fullName.trim()
        && street.trim()
        && city.trim()
        && state.trim()
        && zip.trim()
      ) {
        try {
          await fetch('/api/researcher/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              full_name: fullName.trim(),
              street1: street.trim(),
              street2: suite.trim() || null,
              city: city.trim(),
              state: state.trim().toUpperCase(),
              zip: zip.trim(),
              country: 'US',
              is_default: savedAddresses.length === 0,
            }),
          });
        } catch {
        }
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: cart.map(item => ({ id: item.id, quantity: item.quantity, bundleName: item.bundleName })),
          shippingAddress: fulfillmentMethod === 'ship' ? {
            fullName,
            street,
            suite,
            city,
            state,
            zip,
            phone
          } : null,
          fulfillmentMethod,
          shippingOption,
          paymentMethod,
          couponCode: couponDisabled ? null : (appliedCoupon?.code || null),
          idempotencyKey: getIdempotencyKey(),
          agentSlug: agentSlug || null,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed To Process Order.');
      }

      if (typeof data.total === 'number') {
        const srv = Number(data.total);
        setServerTotal(srv);
        setTotalAdjusted(Math.abs(srv - grandTotal) > 0.01);
      }
      setOrderSuccess(data.orderId);
      clearAllCarts();
      resetIdempotencyKey();
      submittedRef.current = false;
    } catch (err: any) {
      submittedRef.current = false;
      setError(err.message ?? 'An Error Occurred While Processing Order.');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentDetails = () => {
    const rawHandle = agentPaymentHandles?.[paymentMethod];
    const handle = typeof rawHandle === 'string' ? rawHandle.trim() : '';
    const noHandle = 'Contact Your Agent For Handle';
    switch (paymentMethod) {
      case 'zelle':
        return {
          label: 'Zelle Payment Details',
          handle: handle || noHandle,
          instructions: handle
            ? `Send Total Amount To: ${handle}. Please Include Your Order ID In The Memo Field.`
            : 'Contact Your Agent For Zelle Payment Instructions.',
        };
      case 'cashapp':
        return {
          label: 'Cash App Details',
          handle: handle || noHandle,
          instructions: handle
            ? `Send Total Amount To Cash App: ${handle}. Please Reference Your Order ID In Memo.`
            : 'Contact Your Agent For Cash App Payment Instructions.',
        };
      case 'venmo':
        return {
          label: 'Venmo Payment Details',
          handle: handle || noHandle,
          instructions: handle
            ? `Send Total Amount To Venmo: ${handle}. Please Reference Your Order ID In Memo.`
            : 'Contact Your Agent For Venmo Payment Instructions.',
        };
      case 'apple_cash':
        return {
          label: 'Apple Cash Details',
          handle: handle || noHandle,
          instructions: handle
            ? `Send Total Amount Via Apple Cash To: ${handle}. Please Reference Your Order ID.`
            : 'Contact Your Agent For Apple Cash Payment Instructions.',
        };
      default:
        return {
          label: 'Payment Details',
          handle: handle || noHandle,
          instructions: handle
            ? `Send Total Amount To: ${handle}. Please Reference Your Order ID.`
            : 'Contact Your Agent For Payment Instructions.',
        };
    }
  };

  if (cart.length === 0 && !orderSuccess) {
    return (
      <div className="container-sm section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="glass-panel hover-lift stagger-fade-in" style={{ width: '100%', maxWidth: 500, textAlign: 'center', padding: 'var(--space-8)' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--teal)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: 'var(--space-4)', display: 'inline-block' }}
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Your Shopping Cart Is Empty</h2>
          <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-6)' }}>Add Research Compounds From The Catalog To Proceed.</p>
          <Link href={agentSlug ? `/${agentSlug}` : '/dashboard'} className="btn btn-primary">
            Browse Catalog
          </Link>
        </div>
      </div>
    );
  }

  if (orderSuccess) {
    const payment = getPaymentDetails();
    return (
      <div className="container-sm section" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10) var(--space-4)' }}>
        <div className="glass-panel stagger-fade-in" style={{ width: '100%', maxWidth: 640, padding: 'var(--space-8)', border: '2px solid var(--teal)', boxShadow: '0 0 30px rgba(192, 184, 168, 0.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(192, 184, 168, 0.1)',
              border: '2px solid var(--teal)',
              color: 'var(--teal)',
              marginBottom: 'var(--space-4)',
              boxShadow: 'var(--shadow-teal-sm)'
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ fontSize: '2rem', color: 'var(--teal)', marginBottom: 'var(--space-2)' }}>Order Placed Successfully</h1>
            <p style={{ color: 'var(--silver)', fontSize: '0.95rem' }}>Your Research Order Has Been Registered And Is Awaiting Offline Payment.</p>
          </div>

          {totalAdjusted && serverTotal !== null && (
            <div className="glass-panel" style={{ background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.15)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', gap: 12, alignItems: 'flex-start', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p style={{ color: 'var(--teal)', fontWeight: 700, fontSize: '0.88rem', margin: '0 0 4px' }}>Total Was Adjusted</p>
                <p style={{ color: 'var(--silver-light)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
                  Your Confirmed Order Total Is <strong style={{ color: 'var(--teal)' }}>${serverTotal.toFixed(2)}</strong>. Shipping Rates May Have Updated Since Your Cart Was Loaded. Please Send Exactly <strong style={{ color: 'var(--teal)' }}>${serverTotal.toFixed(2)}</strong> To The Payment Handle Below.
                </p>
              </div>
            </div>
          )}


          <div className="glass-panel" style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <span style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Identifier</span>
              <strong style={{ color: 'var(--white)', fontFamily: 'var(--font-brand)', fontSize: '0.95rem', wordBreak: 'break-all' }}>{orderSuccess}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <span style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Method</span>
              <strong style={{ color: 'var(--white)', fontSize: '0.95rem', textTransform: 'capitalize' }}>{paymentMethod === 'cashapp' ? 'Cash App' : paymentMethod === 'apple_cash' ? 'Apple Cash' : paymentMethod}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
              <span style={{ color: 'var(--grey-400)', fontWeight: 600 }}>Amount Due</span>
              <strong style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>
                ${(serverTotal ?? grandTotal).toFixed(2)}
              </strong>
            </div>
          </div>

          <div className="glass-panel" style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-8)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--teal)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-brand)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="var(--teal)"
                stroke="var(--teal)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'inline-block' }}
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>{' '}
              {payment.label}
            </h3>
            <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)', letterSpacing: '0.05em', background: 'rgba(0, 240, 255, 0.05)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0, 240, 255, 0.1)', textAlign: 'center', marginBottom: 'var(--space-3)', textShadow: '0 0 10px rgba(0,240,255,0.3)' }}>
              {payment.handle}
            </div>
            <p style={{ color: 'var(--silver-light)', fontSize: '0.88rem', margin: 0, lineHeight: 1.6 }}>
              {payment.instructions}
            </p>
          </div>

          <PaymentProofUpload orderId={orderSuccess} />

          <div className="glass-panel" style={{ background: 'rgba(229, 62, 62, 0.05)', border: '1px solid rgba(229, 62, 62, 0.15)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)' }}>
            <h4 style={{ color: 'var(--red)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: 'var(--font-brand)', textShadow: '0 0 10px rgba(229, 62, 62, 0.3)' }}>Strict Legal Reminder</h4>
            <p style={{ color: 'var(--silver-light)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>
              All Products Purchased Are Restrictively Designated For Laboratory Experimentation And Chemical Analysis Only. Any Therapeutic Use Or Human Consumption Is Stringently Prohibited.
            </p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <a href={agentSlug ? `/${agentSlug}` : '/dashboard'} className="btn btn-primary" style={{ minWidth: 200, display: 'inline-block', lineHeight: '42px', textDecoration: 'none' }}>
              Return To Catalog
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-container page-transition" style={{ padding: 'var(--space-6)', maxWidth: 1200, margin: '0 auto', paddingBottom: '100px' }}>
      
      {!meetsOverallMin && totalCartQty > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', color: '#fca5a5', textAlign: 'center' }}>
          <strong>Order Minimum Not Met:</strong> This storefront requires an overall minimum order of {minOverallQty} items. You currently have {totalCartQty} item{totalCartQty !== 1 ? 's' : ''} in your cart. Please go back to the store and add more items before checking out.
        </div>
      )}

      {/* Research-use-only compound warnings: stacked
          pro-angiogenic / multiple GLP-1 agents, and cold-chain handling. */}
      <CartWarnings productIds={cart.map((item) => item.id)} />

      {/* Stale cart warning - shown if the cart is older than 24 hours */}
      {cartIsStale && (
        <div style={{ background: 'rgba(245, 158, 11, 0.07)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{ fontSize: '0.82rem', color: '#F59E0B', margin: 0 }}>
            <strong>Your cart prices may be outdated.</strong> This cart was loaded more than 24 hours ago. Return to the storefront to refresh prices before completing your order.
          </p>
        </div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
        <h1 className="animated-gradient-text" style={{ fontSize: 'clamp(1.4rem, 5vw, 2.2rem)', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>Secure Order Checkout</h1>
        <p style={{ color: 'var(--silver)' }}>Complete Your Compliance Steps To Register Your Research Request.</p>
      </div>


      {/* Stepper progress */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-8)', flexWrap: 'wrap' }}>
        {[
          { num: 1, label: 'Fulfillment' },
          { num: 2, label: 'Billing' },
          { num: 3, label: 'Compliance' }
        ].map((s) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontFamily: 'var(--font-brand)',
              fontSize: '0.88rem',
              background: step === s.num ? 'var(--teal)' : step > s.num ? 'rgba(192, 184, 168, 0.15)' : 'var(--surface-3)',
              color: step === s.num ? '#fff' : step > s.num ? 'var(--teal)' : 'var(--silver-dark)',
              border: step >= s.num ? '1px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: step === s.num ? 'var(--shadow-teal-sm)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              {s.num}
            </div>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              fontFamily: 'var(--font-brand)',
              color: step === s.num ? 'var(--teal)' : step > s.num ? 'var(--white)' : 'var(--silver-dark)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}>
              {s.label}
            </span>
            {s.num < 3 && (
              <div style={{ width: 40, height: 1, background: step > s.num ? 'var(--teal)' : 'rgba(255, 255, 255, 0.1)', margin: '0 8px' }} />
            )}
          </div>
        ))}
      </div>

      <div className="checkout-grid">
        <style>{`
          .fulfillment-grid {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
            gap: var(--space-4) !important;
          }
          .step-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: var(--space-4);
            gap: 10px;
          }
          .step-buttons.right {
            justify-content: flex-end;
          }
          @media (max-width: 768px) {
            .checkout-grid {
              grid-template-columns: 1fr !important;
            }
            .checkout-grid > :last-child {
              order: -1;
            }
            .fulfillment-grid, .payment-grid {
              grid-template-columns: 1fr !important;
            }
            .address-city-grid {
              grid-template-columns: 2fr 1.2fr 1.2fr !important;
            }
            .coupon-row {
              flex-direction: column !important;
            }
            .coupon-row input {
              width: 100% !important;
            }
            .coupon-row button {
              width: 100% !important;
              padding: 10px !important;
            }
            .step-buttons {
              flex-direction: column-reverse;
            }
            .step-buttons button {
              width: 100% !important;
              min-width: unset !important;
            }
          }
          @media (max-width: 400px) {
            .address-city-grid {
              grid-template-columns: 1fr !important;
            }
          }
          .premium-input {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--white);
            border-radius: 8px;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease;
          }
          .premium-input:focus {
            border-color: rgba(255, 255, 255, 0.3);
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 0 3px rgba(255, 255, 255, 0.05);
            background: rgba(0, 0, 0, 0.6);
          }
        `}</style>
        <div className="glass-panel hover-lift stagger-fade-in" style={{ width: '100%' }}>
          <div className="" style={{ padding: 'var(--space-6)' }}>
          {error && (
            <div style={{ borderLeft: '3px solid var(--red)', background: 'var(--red-bg)', padding: 'var(--space-4)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--red)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p style={{ color: 'var(--red)', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                  <h3 style={{ color: 'var(--teal)', fontSize: '1.2rem', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)' }}>
                    Fulfillment Method
                  </h3>
                  <div className="fulfillment-grid">
                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      background: shippingOption === 'agent_pickup' ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)',
                      border: shippingOption === 'agent_pickup' ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      boxShadow: shippingOption === 'agent_pickup' ? 'var(--shadow-teal-sm)' : 'none',
                      transition: 'all 0.25s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="radio"
                            name="shippingOption"
                            checked={shippingOption === 'agent_pickup'}
                            onChange={() => {
                              setShippingOption('agent_pickup');
                              setFulfillmentMethod('agent_pickup');
                            }}
                            style={{ accentColor: 'var(--teal)' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--white)', fontSize: '0.95rem', lineHeight: '1.2' }}>Free Shipping To Agent</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: '2px' }}>7-10 Days</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#68D391' }}>
                          Free
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', paddingLeft: 22 }}>
                        Zero cost shipping to your referring representative. Coordinate pickup directly.
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      background: shippingOption === 'fedex' ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)',
                      border: shippingOption === 'fedex' ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      boxShadow: shippingOption === 'fedex' ? 'var(--shadow-teal-sm)' : 'none',
                      transition: 'all 0.25s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="radio"
                            name="shippingOption"
                            checked={shippingOption === 'fedex'}
                            onChange={() => {
                              setShippingOption('fedex');
                              setFulfillmentMethod('ship');
                            }}
                            style={{ accentColor: 'var(--teal)' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--white)', fontSize: '0.95rem', lineHeight: '1.2' }}>FedEx - UPS</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: '2px' }}>6-9 Days</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--teal)' }}>
                          ${getShippingCost('fedex', totalWeightOz).toFixed(2)}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', paddingLeft: 22 }}>
                        Fast shipping. Base rate is $80 for the first 500g, plus $10 for each additional 500g.
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      background: shippingOption === 'usps' ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)',
                      border: shippingOption === 'usps' ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      boxShadow: shippingOption === 'usps' ? 'var(--shadow-teal-sm)' : 'none',
                      transition: 'all 0.25s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="radio"
                            name="shippingOption"
                            checked={shippingOption === 'usps'}
                            onChange={() => {
                              setShippingOption('usps');
                              setFulfillmentMethod('ship');
                            }}
                            style={{ accentColor: 'var(--teal)' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--white)', fontSize: '0.95rem', lineHeight: '1.2' }}>USPS International</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: '2px' }}>12-18 Days</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--teal)' }}>
                          ${getShippingCost('usps', totalWeightOz).toFixed(2)}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', paddingLeft: 22 }}>
                        Cheaper shipping. Base rate is $40 for the first 500g, plus $10 for each additional 500g.
                      </span>
                    </label>
                  </div>
                </div>

                {fulfillmentMethod === 'ship' && (
                  <div>
                    <h3 style={{ color: 'var(--teal)', fontSize: '1.2rem', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)' }}>
                      Shipping Delivery Address
                    </h3>

                    {!savedAddressesLoading && savedAddresses.length > 0 && (
                      <div style={{ marginBottom: 'var(--space-5)' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Saved Addresses</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                          {savedAddresses.map((a) => (
                            <label
                              key={a.id}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 'var(--space-3)',
                                padding: 'var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                background: selectedAddressId === a.id ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)',
                                border: selectedAddressId === a.id ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="radio"
                                name="savedAddress"
                                checked={selectedAddressId === a.id}
                                onChange={() => pickSavedAddress(a.id)}
                                style={{ accentColor: 'var(--teal)', marginTop: 4 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.88rem', color: 'var(--white)', fontWeight: 600 }}>
                                  {a.label || a.full_name}
                                  {a.is_default && (
                                    <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--teal)', fontWeight: 700 }}>Default</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 2 }}>
                                  {a.street1}{a.street2 ? `, ${a.street2}` : ''}, {a.city}, {a.state} {a.zip}
                                </div>
                              </div>
                            </label>
                          ))}

                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              padding: 'var(--space-3)',
                              borderRadius: 'var(--radius-md)',
                              background: selectedAddressId === 'new' ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)',
                              border: selectedAddressId === 'new' ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="radio"
                              name="savedAddress"
                              checked={selectedAddressId === 'new'}
                              onChange={() => pickSavedAddress('new')}
                              style={{ accentColor: 'var(--teal)' }}
                            />
                            <span style={{ fontSize: '0.88rem', color: 'var(--white)', fontWeight: 600 }}>Use A New Address</span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                          type="text"
                          className="form-input premium-input"
                          placeholder="First And Last Name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>

                      <div className="grid-2">
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label">Street Address</label>
                          <AddressAutocompleteInput
                            className="form-input premium-input"
                            placeholder="123 Lab Street"
                            value={street}
                            onChange={setStreet}
                            onSelect={(a) => { setStreet(a.street1); if (a.city) setCity(a.city); if (a.state) setState(a.state); if (a.zip) setZip(a.zip); }}
                          />
                        </div>
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Suite Or Apartment</label>
                          <input
                            type="text"
                            className="form-input premium-input"
                            placeholder="Suite 404 (Optional)"
                            value={suite}
                            onChange={(e) => setSuite(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="address-city-grid">
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label">City</label>
                          <input
                            type="text"
                            className="form-input premium-input"
                            placeholder="Science City"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label">State</label>
                          <select
                            className="form-input premium-input"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                          >
                            <option value="">Select State</option>
                            {US_STATES.map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.code} - {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label">Zip Code</label>
                          <input
                            type="text"
                            className="form-input premium-input"
                            placeholder="90210"
                            value={zip}
                            onChange={(e) => setZip(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="tel"
                          className="form-input premium-input"
                          placeholder="123-456-7890 (For Shipping Updates)"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>

                      {selectedAddressId === 'new' && (
                        <label
                          className="form-checkbox"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            padding: 'var(--space-3)',
                            background: 'var(--surface-2)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={saveAddress}
                            onChange={(e) => setSaveAddress(e.target.checked)}
                          />
                          <span style={{ fontSize: '0.84rem', color: 'var(--silver-light)' }}>
                            Save This Address To My Account For Future Orders.
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {fulfillmentMethod === 'agent_pickup' && (
                  <div style={{ background: 'rgba(192, 184, 168, 0.03)', border: '1px solid rgba(192, 184, 168, 0.2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                    <h4 style={{ color: 'var(--teal)', fontSize: '0.95rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)' }}>Agent Hand-Off Confirmation</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--silver-light)', margin: 0, lineHeight: 1.6 }}>
                      You Have Opted For Manual In-Person Pickup. No Package Shipping Fee Will Be Charged.
                      Please Arrange Coordinates With Your Local Partner Following Order Placement.
                    </p>
                  </div>
                )}

                <div className="step-buttons">
                  <Link href={agentSlug ? `/${agentSlug}` : '/'} className="btn-neon-cyan" style={{ minWidth: 200, padding: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                    Back To Store
                  </Link>
                  <button 
                    type="button" 
                    onClick={handleNextStep} 
                    className="btn-neon-cyan" 
                    style={{ minWidth: 150, opacity: meetsOverallMin ? 1 : 0.5, cursor: meetsOverallMin ? 'pointer' : 'not-allowed' }}
                    disabled={!meetsOverallMin}
                  >
                    Continue To Payment
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                  <h3 style={{ color: 'var(--teal)', fontSize: '1.2rem', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)' }}>
                    Billing Offline Payment Method
                  </h3>
                  <p style={{ color: 'var(--silver-light)', fontSize: '0.85rem', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
                    Select Your Preferred Offline Channel To Finalize Cash Settlement. Our Staff Will Release Your Lab Experimentation Order Instantly Upon Verifying Receipt.
                  </p>

                  <div className="payment-grid">
                    {availablePaymentMethods.map((p) => (
                      <label key={p.id} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                        background: paymentMethod === p.id ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)',
                        border: paymentMethod === p.id ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        boxShadow: paymentMethod === p.id ? 'var(--shadow-teal-sm)' : 'none',
                        transition: 'all 0.25s ease'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === p.id}
                            onChange={() => setPaymentMethod(p.id)}
                            style={{ accentColor: 'var(--teal)', flexShrink: 0 }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 48, flexShrink: 0 }}>
                              {p.icon}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap', overflow: 'hidden' }}>
                              <strong style={{ color: 'var(--white)', fontSize: '1.05rem', fontFamily: 'var(--font-brand)', margin: 0, padding: 0, lineHeight: 1, whiteSpace: 'nowrap' }}>{p.name}</strong>
                              {agentPaymentHandles?.[p.id] && (
                                <>
                                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1rem', lineHeight: 1 }}>-</span>
                                  <span style={{ fontSize: '0.95rem', color: 'var(--silver)', lineHeight: 1, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {agentPaymentHandles[p.id]}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                  <h4 style={{ color: 'var(--silver-light)', fontSize: '0.88rem', marginBottom: 'var(--space-2)' }}>Payment Process Notice</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0, lineHeight: 1.5 }}>
                    Your Checkout Complete Order ID Will Be Displayed Following Submission. Simply Complete Payment Settlement via The Listed Handle And Input Your Order ID In The Payment Reference.
                  </p>
                </div>

                <div className="step-buttons">
                  <button type="button" onClick={handlePrevStep} className="btn" style={{ minWidth: 150, background: 'rgba(255,255,255,0.05)', color: 'var(--white)' }}>
                    Back
                  </button>
                  <button type="button" onClick={handleNextStep} className="btn-neon-cyan" style={{ minWidth: 150 }}>
                    Continue To Terms
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                  <h3 style={{ color: 'var(--red)', fontSize: '1.2rem', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)' }}>
                    Compliance Research Agreement
                  </h3>
                  <p style={{ color: 'var(--silver-light)', fontSize: '0.85rem', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
                    Please Review And Attest To All Compliance Agreements Below. Your Strict Lab Affirmations Are Stored In Audited Database Ledgers For Mandatory Safety Protocols.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    <label className="form-checkbox" style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)' }}>
                      <input
                        type="checkbox"
                        checked={disclaimer1}
                        onChange={(e) => setDisclaimer1(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.82rem', color: 'var(--silver-light)', lineHeight: 1.5 }}>
                        I Acknowledge That All Products Ordered Are Intended For Lab Research Use Only.
                      </span>
                    </label>

                    <label className="form-checkbox" style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)' }}>
                      <input
                        type="checkbox"
                        checked={disclaimer2}
                        onChange={(e) => setDisclaimer2(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.82rem', color: 'var(--silver-light)', lineHeight: 1.5 }}>
                        I Understand That These Compounds Are Not Approved For Human Ingestion Or Consumption.
                      </span>
                    </label>

                    <label className="form-checkbox" style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)' }}>
                      <input
                        type="checkbox"
                        checked={disclaimer3}
                        onChange={(e) => setDisclaimer3(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.82rem', color: 'var(--silver-light)', lineHeight: 1.5 }}>
                        I Certify That The Research Facility Meets All Necessary Safety And Compliance Standards.
                      </span>
                    </label>
                  </div>
                </div>

                <div style={{ borderLeft: '3px solid var(--red)', background: 'var(--red-bg)', padding: 'var(--space-4)', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
                  <h4 style={{ color: 'var(--red)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: 'var(--font-brand)' }}>Binding Attestation</h4>
                  <p style={{ color: 'var(--silver-light)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>
                    Acceptance Of These Agreements Digitally Validates Your Institutional Consent. False Audits May Result In Restrictive Ban Of Profile Access To All Catalog Inventory.
                  </p>
                </div>

                <div className="step-buttons">
                  <button type="button" onClick={handlePrevStep} className="btn" style={{ minWidth: 150, background: 'rgba(255,255,255,0.05)', color: 'var(--white)' }} disabled={loading}>
                    Back
                  </button>
                  <button type="submit" className="btn-neon-cyan" style={{ minWidth: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={loading}>
                    {loading ? (
                      <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      'Place Research Order'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="glass-panel">
            <div className="" style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--white)', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Order Inventory
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: 220, overflowY: 'auto', paddingRight: 4, marginBottom: 'var(--space-4)' }}>
              {/* Group items by bundleName */}
              {(() => {
                const groupedCart: { isBundle: boolean, name: string, items: typeof cart }[] = [];
                const processedIds = new Set<string>();

                cart.forEach(item => {
                  const key = item.id + '-' + (item.bundleName || '');
                  if (processedIds.has(key)) return;
                  
                  if (item.bundleName) {
                    const bundleItems = cart.filter(i => i.bundleName === item.bundleName);
                    if (!groupedCart.find(g => g.isBundle && g.name === item.bundleName)) {
                      groupedCart.push({ isBundle: true, name: item.bundleName, items: bundleItems });
                    }
                    bundleItems.forEach(i => processedIds.add(i.id + '-' + i.bundleName));
                  } else {
                    groupedCart.push({ isBundle: false, name: item.name, items: [item] });
                    processedIds.add(key);
                  }
                });

                return groupedCart.map((group, groupIndex) => {
                  if (group.isBundle) {
                    const bundleSubtotal = group.items.reduce((acc, item) => {
                      const bulkEligible = !isAgentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold;
                      const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice;
                      return acc + (activePrice * 0.9) * item.quantity;
                    }, 0);

                    return (
                      <div key={`bundle-${group.name}-${groupIndex}`} style={{
                        background: 'rgba(0, 229, 255, 0.03)',
                        border: '1px solid rgba(0, 229, 255, 0.2)',
                        borderRadius: 8,
                        padding: '10px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                        marginBottom: 6
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,229,255,0.1)', paddingBottom: 6, marginBottom: 4 }}>
                          <div>
                            <h4 style={{ fontSize: '0.85rem', margin: 0, fontFamily: 'var(--font-brand)', color: '#00E5FF', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {group.name}
                            </h4>
                            <div style={{ fontSize: '0.65rem', color: '#68D391', marginTop: 2, fontWeight: 700 }}>Stack Discount (10% Off) Applied</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--grey-400)', marginTop: 4, fontStyle: 'italic', maxWidth: '90%' }}>
                              Note: This peptide stack is not all inside one vial, it is individually packaged as the vials listed below.
                            </div>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#00E5FF', fontWeight: 800 }}>${bundleSubtotal.toFixed(2)}</div>
                        </div>
                        {group.items.map(item => {
                          const retail = (item as any).retailPrice ?? item.costPrice;
                          const bulkEligible = !isAgentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold;
                          const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice;
                          
                          return (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', alignItems: 'flex-start', paddingLeft: 6 }}>
                              <div style={{ flexGrow: 1, paddingRight: 'var(--space-3)' }}>
                                <span style={{ color: 'var(--silver-light)', fontWeight: 500 }}>&#x21B3; {toTitleCase(item.name)}</span>
                                <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>Qty: {item.quantity}</div>
                              </div>
                              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ color: 'var(--grey-500)', fontSize: '0.70rem', textDecoration: 'line-through' }}>
                                  ${(activePrice * item.quantity).toFixed(2)}
                                </div>
                                <strong style={{ color: '#00E5FF' }}>
                                  ${((activePrice * 0.9) * item.quantity).toFixed(2)}
                                </strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // Standard individual item
                  return group.items.map(item => {
                    const retail = (item as any).retailPrice ?? item.costPrice;
                    const showDiscount = isAgentSelfBuy && retail > item.costPrice;
                    const bulkEligible = !isAgentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold;
                    const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice;
                    
                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ flexGrow: 1, paddingRight: 'var(--space-3)' }}>
                          <span style={{ color: 'var(--white)', fontWeight: 500 }}>{toTitleCase(item.name)}</span>
                          <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>Qty: {item.quantity}</div>
                        </div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {showDiscount && (
                            <div style={{ color: 'var(--grey-500)', fontSize: '0.70rem', textDecoration: 'line-through' }}>
                              ${(retail * item.quantity).toFixed(2)}
                            </div>
                          )}
                          <strong style={{ color: showDiscount ? 'var(--teal)' : 'var(--silver-light)' }}>
                            ${(activePrice * item.quantity).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    );
                  });
                });
              })()}
            </div>

            {/* Bacteriostatic Water Suggestion Box */}
            {neededBacWaterVials > 0 && bacProduct && (
              <div style={{
                background: 'rgba(0, 196, 188, 0.04)',
                border: '1px solid rgba(0, 196, 188, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                boxShadow: '0 0 15px rgba(0, 196, 188, 0.08)',
                transition: 'all 0.3s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong style={{ color: 'var(--white)', fontSize: '0.82rem', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Reconstitution Supplies
                  </strong>
                </div>
                <p style={{ color: 'var(--silver-light)', fontSize: '0.76rem', margin: '0 0 10px', lineHeight: 1.4 }}>
                  Your order contains <strong style={{ color: 'var(--white)' }}>{bacPeptideVials}</strong> research vial{bacPeptideVials !== 1 ? 's' : ''} requiring BAC Water. You need approximately <strong style={{ color: 'var(--white)' }}>{requiredBacWaterVials}</strong> vial{requiredBacWaterVials !== 1 ? 's' : ''} of Bacteriostatic Water.
                </p>
                <button
                  type="button"
                  onClick={handleAddBacWater}
                  className="btn-neon-cyan"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    borderRadius: 6,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>Add {neededBacWaterVials} Vials To Order</span>
                  <strong style={{ color: 'var(--white)' }}>
                    (${((isAgentSelfBuy ? bacProduct.costPrice : bacProduct.retailPrice) * neededBacWaterVials).toFixed(2)})
                  </strong>
                </button>
              </div>
            )}

            {/* Acetic Acid Suggestion Box */}
            {neededAceticAcidVials > 0 && aceticProduct && (
              <div style={{
                background: 'rgba(235, 178, 54, 0.04)',
                border: '1px solid rgba(235, 178, 54, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                boxShadow: '0 0 15px rgba(235, 178, 54, 0.08)',
                transition: 'all 0.3s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong style={{ color: 'var(--white)', fontSize: '0.82rem', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Special Reconstitution Supplies
                  </strong>
                </div>
                <p style={{ color: 'var(--silver-light)', fontSize: '0.76rem', margin: '0 0 10px', lineHeight: 1.4 }}>
                  Your order contains <strong style={{ color: 'var(--white)' }}>{aceticPeptideVials}</strong> research vial{aceticPeptideVials !== 1 ? 's' : ''} requiring Acetic Acid for solubility. You need approximately <strong style={{ color: 'var(--white)' }}>{requiredAceticAcidVials}</strong> vial{requiredAceticAcidVials !== 1 ? 's' : ''} of Acetic Acid 0.6%.
                </p>
                <button
                  type="button"
                  onClick={handleAddAceticAcid}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    borderRadius: 6,
                    transition: 'all 0.2s ease',
                    background: 'transparent',
                    border: '1px solid #EBB236',
                    color: '#EBB236',
                    boxShadow: '0 0 12px rgba(235, 178, 54, 0.25)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#EBB236';
                    e.currentTarget.style.color = '#000000';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#EBB236';
                  }}
                >
                  <span>Add {neededAceticAcidVials} Vials To Order</span>
                  <strong style={{ color: 'inherit' }}>
                    (${((isAgentSelfBuy ? aceticProduct.costPrice : aceticProduct.retailPrice) * neededAceticAcidVials).toFixed(2)})
                  </strong>
                </button>
              </div>
            )}

            {!couponDisabled && (
            <div style={{ paddingTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              {appliedCoupon ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(104,211,145,0.08)', border: '1px solid rgba(104,211,145,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
                  <span style={{ fontSize: '0.78rem', color: '#68D391', fontWeight: 600 }}>
                    Coupon {appliedCoupon.code} Applied
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    style={{ background: 'none', border: 'none', color: 'var(--grey-400)', fontSize: '0.74rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="coupon-row" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input
                    type="text"
                    className="form-input premium-input"
                    placeholder="Coupon Code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    style={{ margin: 0, flexGrow: 1, fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponLoading}
                    className="btn-neon-cyan"
                    style={{ fontSize: '0.78rem', padding: '0 var(--space-4)' }}
                  >
                    {couponLoading ? 'Checking' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && (
                <p style={{ fontSize: '0.72rem', color: 'var(--red)', margin: 'var(--space-2) 0 0' }}>{couponError}</p>
              )}
            </div>
            )}

            <div style={{ paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--grey-400)' }}>{isAgentSelfBuy ? 'Agent Direct Subtotal' : 'Items Subtotal'}</span>
                <strong style={{ color: 'var(--white)' }}>${cartSubtotal.toFixed(2)}</strong>
              </div>

              {agentPricingDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '6px 10px', background: 'rgba(0,196,188,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,196,188,0.2)' }}>
                  <span style={{ color: 'var(--teal)', fontWeight: 600 }}>Agent Direct Pricing Discount</span>
                  <strong style={{ color: 'var(--teal)' }}>-${agentPricingDiscount.toFixed(2)}</strong>
                </div>
              )}

              {appliedCoupon && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#68D391' }}>Coupon Discount</span>
                  <strong style={{ color: '#68D391' }}>-${discount.toFixed(2)}</strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--grey-400)' }}>
                  {shippingOption === 'fedex' ? 'FedEx / UPS Fast' : shippingOption === 'usps' ? 'USPS / China Post Cheap' : 'Fulfillment'}
                </span>
                {shippingOption !== 'agent_pickup' ? (
                  <strong style={{ color: 'var(--white)' }}>${shippingCost.toFixed(2)}</strong>
                ) : (
                  <strong style={{ color: 'var(--teal)' }}>Free Shipping to Agent</strong>
                )}
              </div>

              {shippingOption !== 'agent_pickup' && (
                <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textAlign: 'right', marginTop: -4 }}>
                  Total Weight: {totalWeightOz.toFixed(1)} Oz ({(totalWeightOz * 28.3495).toFixed(0)}g)
                </div>
              )}



              <div style={{ paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', marginTop: 'var(--space-1)' }}>
                <span style={{ color: 'var(--white)', fontWeight: 600 }}>Total Due</span>
                <strong style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>
                  ${grandTotal.toFixed(2)}
                </strong>
              </div>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginTop: '2px', flexShrink: 0 }}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div>
              <h4 style={{ fontSize: '0.78rem', color: 'var(--white)', marginBottom: 2, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Encrypted Ledger Transact</h4>
              <p style={{ fontSize: '0.7rem', color: 'var(--grey-400)', margin: 0, lineHeight: 1.4 }}>
                All Catalog Registrations Are Processed With Cryptographic Integrity In Compliance With Private Bio-Science Regulations.
              </p>
            </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
