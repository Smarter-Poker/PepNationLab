'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/CartContext';
import { reportClientError } from '@/lib/report-client-error';
import CartWarnings from '@/components/research/CartWarnings';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { US_STATES } from '@/lib/us-states';
import PaymentProofUpload from '@/components/PaymentProofUpload';
import { toTitleCase } from '@/lib/categoryImage';
import { createClient } from '@/lib/supabase/client';
import { calculateShippingCost as getShippingCost, ShippingOption } from '@/lib/shipping-cost';
import AddressAutocompleteInput from '@/components/AddressAutocompleteInput';
import { Copy, Check } from 'lucide-react';
import { quantityDiscountPct, isVolumeDiscountExcluded } from '@/lib/quantity-discount';
import { trackStorefrontEvent } from '@/lib/track';

type PaymentMethodId = 'zelle' | 'cashapp' | 'venmo' | 'apple_pay' | 'apple_cash' | 'paypal' | 'google_wallet' | 'wise' | 'chime' | 'varo';

const baseStyle = { height: 28, width: 'auto', objectFit: 'contain' as const };
const scaleStyle = (scale: number) => ({ ...baseStyle, transform: `scale(${scale})` });

// Every payment method the platform supports. The checkout list is filtered
// down to the methods the agent actually has a handle for, so an agent whose
// only handle is (for example) Varo or PayPal still gives their researchers a
// working payment option instead of an empty list.
const ALL_PAYMENT_METHODS: { id: PaymentMethodId; name: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'zelle',      name: 'Zelle',      desc: 'Instant Direct Transfer. Fastest Processing.', icon: <Image src="/payment-logos/zelle.svg" width={40} height={28} alt="Zelle" unoptimized style={baseStyle} /> },
  { id: 'cashapp',    name: 'Cash App',   desc: 'Secure Mobile Check. Handled Manually.', icon: <Image src="/payment-logos/cashapp.svg" width={40} height={28} alt="Cash App" unoptimized style={baseStyle} /> },
  { id: 'venmo',      name: 'Venmo',      desc: 'Social Transfer. Manual Clearance.', icon: <Image src="/payment-logos/venmo.svg" width={40} height={28} alt="Venmo" unoptimized style={scaleStyle(1.4)} /> },
  { id: 'apple_pay',  name: 'Apple Pay',  desc: 'Tap To Pay. Instant Mobile Checkout.', icon: <Image src="/payment-logos/apple_cash.svg" width={40} height={28} alt="Apple Pay" unoptimized style={scaleStyle(1.4)} /> },
  { id: 'apple_cash', name: 'Apple Cash', desc: 'Secure Contactless Flow. Fast Settlement.', icon: <Image src="/payment-logos/apple_cash.svg" width={40} height={28} alt="Apple Cash" unoptimized style={scaleStyle(1.4)} /> },
  { id: 'paypal',        name: 'PayPal',        desc: 'Send Directly To Your Agent By Email.', icon: <Image src="/payment-logos/paypal.svg" width={40} height={28} alt="PayPal" unoptimized style={baseStyle} /> },
  { id: 'google_wallet', name: 'Google Wallet', desc: 'Google Pay Transfer Via Email Or Phone.', icon: <Image src="/payment-logos/google_wallet.svg" width={40} height={28} alt="Google Wallet" unoptimized style={scaleStyle(1.4)} /> },
  { id: 'wise',          name: 'Wise',          desc: 'Bank-Linked Transfer By Email.', icon: <Image src="/payment-logos/wise.svg" width={40} height={28} alt="Wise" unoptimized style={baseStyle} /> },
  { id: 'chime',         name: 'Chime',         desc: 'Chime Pay Anyone Transfer.', icon: <Image src="/payment-logos/chime.png" width={40} height={28} alt="Chime" unoptimized style={baseStyle} /> },
  { id: 'varo',          name: 'Varo',          desc: 'Varo Bank Instant Transfer.', icon: <Image src="/payment-logos/varo.svg" width={40} height={28} alt="Varo" unoptimized style={baseStyle} /> },
];

const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  zelle: 'Zelle', cashapp: 'Cash App', venmo: 'Venmo', apple_pay: 'Apple Pay', apple_cash: 'Apple Cash',
  paypal: 'PayPal', google_wallet: 'Google Wallet', wise: 'Wise', chime: 'Chime', varo: 'Varo',
};

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
  /** Per-Peptide Quantity Discounts (3+/5+/7+ Vials) -- Mirrors The Server */
  volumeDiscountsEnabled?: boolean;
  /** Manufacturer store: items trade in multiples of 10, no coupons ever. */
  manufacturerStore?: boolean;
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

interface ActiveFlashSale {
  id: string;
  name: string;
  banner_text: string | null;
  discount_pct: number;
  starts_at: string;
  ends_at: string;
}

export default function CheckoutForm({ userProfile, userEmail, tierMultipliers, agentSlug, agentPaymentHandles, minOverallQty = 1, minOrderQty = 1, volumeDiscountsEnabled = true, manufacturerStore = false }: CheckoutFormProps) {
  const isAgentByRole = userProfile.role === 'agent' || userProfile.role === 'super_agent';
  const isSubAgent = userProfile.is_sub_agent === true;
  const isAgentSelfBuy = isAgentByRole && !isSubAgent;
  const couponDisabled = isAgentSelfBuy || isSubAgent || manufacturerStore;

  const availablePaymentMethods = (
    agentPaymentHandles &&
    Object.values(agentPaymentHandles).some(v => typeof v === 'string' && v.trim().length > 0)
  )
    ? ALL_PAYMENT_METHODS.filter(p => {
        const h = agentPaymentHandles[p.id];
        return typeof h === 'string' && h.trim().length > 0;
      })
    : ALL_PAYMENT_METHODS;
  const { cart: contextCart, cartSubtotal: contextSubtotal, clearCart, addToCart } = useCart();
  const router = useRouter();

  const storefrontCartKey = agentSlug
    ? `pnl_storefront_cart_${agentSlug}`
    : 'pnl_storefront_cart';

  const [storefrontCart, setStorefrontCart] = useState<Array<{
    id: string; name: string; sku: string; quantity: number;
    retailPrice: number; costPrice: number; weightOz: number;
    bundleName?: string; bundleDiscountPercent?: number;
    /** When set, this item belongs to a custom-priced bundle. Each line's share is proportional to its retail contribution. */
    bundleCustomPrice?: number | null;
    bulkCostPrice?: number | null; bulkThreshold?: number;
  }>>([]);
  const [storefrontLoaded, setStorefrontLoaded] = useState(false);
  const [cartSavedAt, setCartSavedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storefrontCartKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.items)) {
          const validItems = parsed.items.filter((item: any) => 
            item && typeof item === 'object' && 
            typeof item.id === 'string' &&
            typeof item.quantity === 'number' &&
            typeof item.retailPrice === 'number' &&
            typeof item.costPrice === 'number'
          );
          if (validItems.length > 0) setStorefrontCart(validItems);
          if (typeof parsed._savedAt === 'number') setCartSavedAt(parsed._savedAt);
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          const validItems = parsed.filter((item: any) => 
            item && typeof item === 'object' && 
            typeof item.id === 'string' &&
            typeof item.quantity === 'number' &&
            typeof item.retailPrice === 'number' &&
            typeof item.costPrice === 'number'
          );
          if (validItems.length > 0) setStorefrontCart(validItems);
        }
      }
    } catch { /* non-blocking */ }
    setStorefrontLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cart = storefrontCart.length > 0 ? storefrontCart : contextCart;
  const totalCartQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const meetsOverallMin = totalCartQty >= minOverallQty;

  const cartSubtotal = storefrontCart.length > 0
    ? storefrontCart.reduce((sum, item) => {
        let price = item.retailPrice;
        if (item.bundleCustomPrice != null && item.bundleCustomPrice > 0) {
          // custom-priced bundles: use stored per-vial price directly
          price = item.bundleCustomPrice;
        } else if (item.bundleName) {
          price = item.retailPrice * (1 - (item.bundleDiscountPercent ?? 10) / 100);
        }
        return sum + price * item.quantity;
      }, 0)
    : contextSubtotal;

  const agentPricingDiscount = isAgentSelfBuy && storefrontCart.length > 0
    ? storefrontCart.reduce((sum, item) => {
        const retail = item.retailPrice ?? item.costPrice;
        const discountMultiplier = item.bundleName ? (1 - (item.bundleDiscountPercent ?? 10) / 100) : 1;
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
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [totalAdjusted, setTotalAdjusted] = useState(false);

  const cartIsStale = cartSavedAt !== null && (Date.now() - cartSavedAt) > 24 * 60 * 60 * 1000;

  const idempotencyKeyRef = useRef<string | null>(null);
  const submittedRef = useRef<boolean>(false);

  // Mobile UX: validation errors render at the top of the step panel, which
  // can sit above the visual viewport when the software keyboard is open or
  // the user has scrolled to the submit button. Scroll the banner into view
  // whenever a new error is set so it is never raised off-screen.
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (error && errorBannerRef.current) {
      errorBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  const [liveShippingRate, setLiveShippingRate] = useState<number | null>(null);
  // True when the shown rate is the flat weight-based estimate rather than a
  // live carrier quote, so the summary can label it honestly.
  const [shippingEstimated, setShippingEstimated] = useState(false);
  // Live carrier name (e.g. "USPS") when the rate came back from a real quote.
  const [shippingCarrier, setShippingCarrier] = useState<string | null>(null);
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

  useEffect(() => {
    (async () => {
      try {
        if (!agentSlug) {
          const supabase = createClient();
          const { data: bacRows } = await supabase
            .from('products')
            .select('id, name, base_cost, weight_oz, unit_size, unit_measure')
            .eq('compound_slug', 'bac-water')
            .limit(5);
          // Deterministically prefer the 10 mL vial. `.limit(1)` with no ORDER BY
          // returned whichever bac-water row Postgres yielded first (3 mL or
          // 10 mL), silently changing the suggested product and price.
          const p = (bacRows ?? []).find(r => String(r.unit_size) === '10') ?? (bacRows ?? [])[0] ?? null;
          if (p) {
            const basePrice = Number(p.base_cost) || 0;
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
            const basePrice = Number(pAcetic.base_cost) || 0;
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
            
            const bacMatches = items.filter((item: any) => item.products?.compound_slug === 'bac-water');
            // Prefer the 10 mL vial (see the guest-path note above).
            const matched = bacMatches.find((item: any) => String(item.products?.unit_size) === '10') ?? bacMatches[0];
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
          .eq('slug', agentSlug)
          .maybeSingle();

        if (agentProfile) {
          const { data: apRows } = await supabase
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
            .limit(5);

          // Prefer the 10 mL vial (see the guest-path note above).
          const ap = (apRows ?? []).find((row: any) => {
            const pr = (Array.isArray(row.products) ? row.products[0] : row.products) as any;
            return String(pr?.unit_size) === '10';
          }) ?? (apRows ?? [])[0] ?? null;

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
      } catch (err) {
        reportClientError('checkout.saved-addresses', err);
      } finally {
        if (!cancelled) setSavedAddressesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('flash_sales')
          .select('id, name, banner_text, discount_pct, starts_at, ends_at')
          .eq('is_active', true)
          .lte('starts_at', new Date().toISOString())
          .gte('ends_at', new Date().toISOString())
          .order('ends_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (aborted || error || !data) return;
        // eslint-disable-next-line react-hooks/immutability
        setFlashSale(data as ActiveFlashSale);
      } catch { /* silent */ }
    })();
    return () => { aborted = true; };
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

  // Final-step BAC water reminder (Step 3, directly above Place Research
  // Order). The Order Inventory panel's reminder is pushed to the TOP of the
  // page on mobile (.checkout-grid > :last-child { order: -1 }), so buyers
  // finishing the form never saw it. This one lives at the true end of the
  // checkout process on every viewport.
  const [bacReminderDismissed, setBacReminderDismissed] = useState(false);
  const [bacAddedQty, setBacAddedQty] = useState(0);
  const [aceticReminderDismissed, setAceticReminderDismissed] = useState(false);
  const [aceticAddedQty, setAceticAddedQty] = useState(0);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [flashSale, setFlashSale] = useState<ActiveFlashSale | null>(null);

  // Acetic-class peptides: reconstitute with dilute acetic acid rather than BAC
  // water. Narrowed 2026-07-18 to match the authoritative per-compound
  // compounds.handling.diluent data: of the on-sale catalog, ONLY IGF-1 LR3/DES
  // list acetic acid. The prior regex wrongly flagged AOD-9604, GHK-Cu, GHRP-2/6,
  // HGH-Fragment, Epithalon, NAD+ and Melanotan as acetic — every one of those
  // actually reconstitutes with bacteriostatic/sterile water, so they now
  // correctly route to the BAC Water suggestion instead.
  const ACETIC_ACID_SLUGS = /\b(igf[-_\s]?1[-_\s]?(lr3|des|des-?1-?3))\b/i;

  // Pre-mixed aqueous products ship as ready liquids and need NO diluent.
  // (The Lipolysis Stack "Lemon Bottle", The Skinny Shot "Lipo-C" -- and any
  // future product named accordingly.) Counting them over-suggested BAC water.
  const isPreMixedName = (name: string | null | undefined) =>
    !!name && /(lemon\s*bottle|skinny\s*shot|lipo-?c\b|pre-?mixed)/i.test(name);

  const isDiluentName = (name: string | null | undefined) => {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower.includes('bac water') || 
           lower.includes('bacteriostatic water') || 
           lower.includes('bac. water') || 
           lower.includes('acetic acid');
  };

  const aceticPeptideVials = (cart || []).reduce((sum, item) => {
    if (isDiluentName(item.name)) return sum;
    const isAcetic = ACETIC_ACID_SLUGS.test(item.name) || (item.sku && ACETIC_ACID_SLUGS.test(item.sku));
    if (!isAcetic) return sum;
    let vialsPerUnit = 1;
    if (item.name.includes('+')) vialsPerUnit = item.name.split('+').length;
    return sum + (vialsPerUnit * item.quantity);
  }, 0);

  const bacPeptideVials = (cart || []).reduce((sum, item) => {
    if (isDiluentName(item.name) || isPreMixedName(item.name)) return sum;
    const isAcetic = ACETIC_ACID_SLUGS.test(item.name) || (item.sku && ACETIC_ACID_SLUGS.test(item.sku));
    if (isAcetic) return sum;
    let vialsPerUnit = 1;
    if (item.name.includes('+')) vialsPerUnit = item.name.split('+').length;
    return sum + (vialsPerUnit * item.quantity);
  }, 0);

  const currentBacWaterVials = (cart || []).reduce((sum, item) => {
    const lower = (item.name || '').toLowerCase();
    if (lower.includes('bac water') || lower.includes('bacteriostatic water') || lower.includes('bac. water')) return sum + item.quantity;
    return sum;
  }, 0);

  const currentAceticAcidVials = (cart || []).reduce((sum, item) => {
    const lower = (item.name || '').toLowerCase();
    if (lower.includes('acetic acid')) return sum + item.quantity;
    return sum;
  }, 0);

  // Platform rule (owner-confirmed 2026-07-18): suggest ONE 10 mL BAC vial per
  // TWO research vials (a generous 5 mL allocation each). Applied consistently
  // with /api/cart/bac-water so the cart drawer and checkout agree.
  const requiredBacWaterVials = bacPeptideVials > 0 ? Math.ceil(bacPeptideVials / 2) : 0;
  const neededBacWaterVials = Math.max(0, requiredBacWaterVials - currentBacWaterVials);

  const requiredAceticAcidVials = aceticPeptideVials > 0 ? aceticPeptideVials : 0;
  const neededAceticAcidVials = Math.max(0, requiredAceticAcidVials - currentAceticAcidVials);

  const handleAddBacWater = () => {
    if (!bacProduct || neededBacWaterVials <= 0) return;
    const suggestedQty = neededBacWaterVials;

    // When storefrontCart is empty, checkout is serving the CONTEXT cart (see the
    // `cart` derivation above). Writing the diluent into storefrontCart here would
    // make it non-empty with ONLY the diluent, and `cart` would then flip to
    // storefrontCart, silently dropping every real context-cart item. Route the
    // add through CartContext so the diluent is appended to the real cart instead.
    if (storefrontCart.length === 0) {
      addToCart({
        id: bacProduct.id,
        productId: bacProduct.id,
        name: bacProduct.name,
        sku: bacProduct.id,
        retailPrice: bacProduct.retailPrice,
        costPrice: bacProduct.costPrice,
        weightOz: bacProduct.weightOz,
      }, suggestedQty);
      return;
    }

    const updatedCart = [...storefrontCart];
    const existingIndex = updatedCart.findIndex(item => item.id === bacProduct.id);
    if (existingIndex > -1) {
      updatedCart[existingIndex] = { ...updatedCart[existingIndex], quantity: updatedCart[existingIndex].quantity + suggestedQty };
    } else {
      updatedCart.push({ id: bacProduct.id, name: bacProduct.name, sku: bacProduct.id, quantity: suggestedQty, retailPrice: bacProduct.retailPrice, costPrice: bacProduct.costPrice, weightOz: bacProduct.weightOz });
    }
    try {
      localStorage.setItem(storefrontCartKey, JSON.stringify({ items: updatedCart, _savedAt: Date.now() }));
      if (agentSlug) {
        const rawCart = localStorage.getItem(`cart_${agentSlug}`);
        const cartItemsObj = rawCart ? JSON.parse(rawCart) : {};
        cartItemsObj[bacProduct.agentProductId] = (cartItemsObj[bacProduct.agentProductId] || 0) + suggestedQty;
        localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(cartItemsObj));
      }
    } catch (e) { console.error('Failed to update cart storage:', e); }
    setStorefrontCart(updatedCart);
  };

  const handleAddAceticAcid = () => {
    if (!aceticProduct || neededAceticAcidVials <= 0) return;
    const suggestedQty = neededAceticAcidVials;

    // Same context-cart guard as handleAddBacWater: if storefrontCart is empty the
    // order is the context cart, so append the diluent through CartContext rather
    // than replacing the displayed/submitted cart with just the diluent.
    if (storefrontCart.length === 0) {
      addToCart({
        id: aceticProduct.id,
        productId: aceticProduct.id,
        name: aceticProduct.name,
        sku: aceticProduct.id,
        retailPrice: aceticProduct.retailPrice,
        costPrice: aceticProduct.costPrice,
        weightOz: aceticProduct.weightOz,
      }, suggestedQty);
      return;
    }

    const updatedCart = [...storefrontCart];
    const existingIndex = updatedCart.findIndex(item => item.id === aceticProduct.id);
    if (existingIndex > -1) {
      updatedCart[existingIndex] = { ...updatedCart[existingIndex], quantity: updatedCart[existingIndex].quantity + suggestedQty };
    } else {
      updatedCart.push({ id: aceticProduct.id, name: aceticProduct.name, sku: aceticProduct.id, quantity: suggestedQty, retailPrice: aceticProduct.retailPrice, costPrice: aceticProduct.costPrice, weightOz: aceticProduct.weightOz });
    }
    try {
      localStorage.setItem(storefrontCartKey, JSON.stringify({ items: updatedCart, _savedAt: Date.now() }));
      if (agentSlug) {
        const rawCart = localStorage.getItem(`cart_${agentSlug}`);
        const cartItemsObj = rawCart ? JSON.parse(rawCart) : {};
        cartItemsObj[aceticProduct.agentProductId] = (cartItemsObj[aceticProduct.agentProductId] || 0) + suggestedQty;
        localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(cartItemsObj));
      }
    } catch (e) { console.error('Failed to update cart storage:', e); }
    setStorefrontCart(updatedCart);
  };

  const totalWeightOz = (cart || []).reduce((acc, item) => acc + (item.weightOz ?? 0.5) * item.quantity, 0);

  useEffect(() => {
    if (shippingFetchAbortRef.current) shippingFetchAbortRef.current.abort();
    const ctrl = new AbortController();
    shippingFetchAbortRef.current = ctrl;
    if (shippingOption === 'agent_pickup') { setLiveShippingRate(0); setShippingEstimated(false); setShippingCarrier(null); return; }
    const addrComplete = !!(street.trim() && city.trim() && state.trim() && zip.trim());
    (async () => {
      try {
        const res = await fetch('/api/shipping-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weightOz: totalWeightOz,
            shippingOption,
            totalQty: (cart || []).reduce((a, it) => a + it.quantity, 0),
            agentSlug,
            // Only send a destination once it is complete, so the server can
            // return a live carrier quote that equals the final charge.
            to: addrComplete ? { street1: street.trim(), city: city.trim(), state: state.trim(), zip: zip.trim(), country: 'US' } : undefined,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        setLiveShippingRate(Number(json.rate) || 0);
        setShippingEstimated(!!json.estimated);
        setShippingCarrier(typeof json.carrier === 'string' && json.carrier ? json.carrier : null);
      } catch (err) {
        const fallback = getShippingCost(shippingOption, totalWeightOz);
        setLiveShippingRate(fallback);
        setShippingEstimated(true);
        setShippingCarrier(null);
        // AbortError is expected whenever this effect re-runs or unmounts -- reporting
        // it would flood the sink. Only a real failure means we silently charged an
        // estimated rate instead of the live one.
        if ((err as { name?: string })?.name !== 'AbortError') {
          reportClientError('checkout.live-shipping-rate', err, { meta: { fallbackRate: fallback } });
        }
      }
    })();
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWeightOz, shippingOption, street, city, state, zip, agentSlug]);

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
      // Pass stashed directly - React state updates are async so couponInput
      // would still be '' if we called applyCoupon() without the override.
      setTimeout(() => {
        try { 
          // eslint-disable-next-line react-hooks/immutability
          applyCoupon(stashed); 
        } catch { /* applyCoupon may throw if cart empty */ }
      }, 50);
    } catch { /* Storage unavailable or malformed */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- applyCoupon uses stashed override via setTimeout; intentional forward-ref
  }, [couponDisabled, cartSubtotal]);

  // Funnel analytics (best-effort): checkout viewed. Fires once per mount.
  // Must run unconditionally BEFORE the storefrontLoaded early return, or the
  // hook count changes between renders and React throws "Rendered more hooks
  // than during the previous render", dumping every checkout into the error boundary.
  useEffect(() => {
    trackStorefrontEvent(agentSlug, 'checkout_start');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentSlug]);

  if (!storefrontLoaded) return null;

  const calculateShippingCost = () => {
    if (shippingOption === 'agent_pickup') return 0;
    if (liveShippingRate !== null) return liveShippingRate;
    return getShippingCost(shippingOption, totalWeightOz);
  };

  const shippingCost = (agentSlug === 'researchstore' && cartSubtotal >= 100) ? 0 : calculateShippingCost();
  const discount = appliedCoupon?.discount ?? 0;
  const flashDiscount = flashSale && cartSubtotal > 0
    ? Math.round(cartSubtotal * (flashSale.discount_pct / 100) * 100) / 100
    : 0;
  // Quantity Discount: 3-4 Vials 10%, 5-6 Vials 15%, 7+ Vials 20% Off -- Per
  // Specific Peptide Line. Mirrors The Server-Side Pricing In /api/orders.
  // Excludes Wholesale Buys, Stack Bundle Items, And Diluents.
  const volumeDiscount = (volumeDiscountsEnabled && !isAgentSelfBuy && !isSubAgent)
    ? cart.reduce((sum, item) => {
        if (item.bundleName || isVolumeDiscountExcluded(item.name)) return sum;
        const pct = quantityDiscountPct(item.quantity);
        if (pct <= 0) return sum;
        const unit = (item as { retailPrice?: number }).retailPrice ?? item.costPrice;
        const discountedUnit = Math.round(unit * (1 - pct / 100) * 100) / 100;
        return sum + Math.max(0, unit - discountedUnit) * item.quantity;
      }, 0)
    : 0;
  const subtotalAfterDiscount = Math.max(0, cartSubtotal - discount - flashDiscount - volumeDiscount) + shippingCost;
  const grandTotal = Math.max(0, subtotalAfterDiscount - agentPricingDiscount);

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      if (!meetsOverallMin) {
        setError(`This Storefront Requires A Minimum Overall Order Of ${minOverallQty} Items. Please Add More Items To Proceed.`);
        return;
      }
      const violatingItem = cart.find(item => !isDiluentName(item.name) && item.quantity < minOrderQty);
      if (violatingItem) {
        setError(`This Storefront Requires A Minimum Of ${minOrderQty} Per Peptide. "${violatingItem.name}" Has Only ${violatingItem.quantity}.`);
        return;
      }
      if (manufacturerStore) {
        const offStep = cart.find(item => item.quantity < 10 || item.quantity % 10 !== 0);
        if (offStep) {
          setError(`This Store Sells In Multiples Of 10. "${offStep.name}" Has ${offStep.quantity} - Please Adjust To 10, 20, 30, And So On.`);
          return;
        }
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
        setError(`Quantity For "${overLimit.name}" Exceeds The Maximum Allowed (10,000 Per Item). Please Reduce The Quantity.`);
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => { setError(null); setStep(prev => prev - 1); };

  const applyCoupon = async (overrideCode?: string) => {
    setCouponError('');
    const code = (overrideCode ?? couponInput).trim();
    if (!code) { setCouponError('Enter A Coupon Code.'); return; }
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

  const removeCoupon = () => { setAppliedCoupon(null); setCouponInput(''); setCouponError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!disclaimer1 || !disclaimer2 || !disclaimer3) {
      setError('You Must Acknowledge All Lab Research Terms Prior To Placing Order.');
      return;
    }

    // 10-vial minimum removed: agents can order any quantity from their own store.

    if (!meetsOverallMin) {
      setError(`This Storefront Requires A Minimum Overall Order Of ${minOverallQty} Items. Please Add More Items To Proceed.`);
      return;
    }
    const violatingItem = cart.find(item => !isDiluentName(item.name) && item.quantity < minOrderQty);
    if (violatingItem) {
      setError(`This Storefront Requires A Minimum Of ${minOrderQty} Per Peptide. "${violatingItem.name}" Has Only ${violatingItem.quantity}.`);
      return;
    }
    if (manufacturerStore) {
      const offStep = cart.find(item => item.quantity < 10 || item.quantity % 10 !== 0);
      if (offStep) {
        setError(`This Store Sells In Multiples Of 10. "${offStep.name}" Has ${offStep.quantity} - Please Adjust To 10, 20, 30, And So On.`);
        return;
      }
    }
    const overLimit = cart.find(item => item.quantity > 10_000);
    if (overLimit) {
      setError(`Quantity For "${overLimit.name}" Exceeds The Maximum Allowed (10,000 Per Item). Please Reduce The Quantity.`);
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
          const addressRes = await fetch('/api/researcher/addresses', {
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
          if (!addressRes.ok) {
            console.error('Failed to save address');
            // We can still proceed with the order even if address save fails,
            // but we log it to console.
          }
        } catch { }
      }

      // Record Layer 3 (add_to_cart) research-use acknowledgment before placing
      // the order. The storefront grid persists its cart straight to
      // localStorage without going through CartContext, so a grid-built cart
      // never records this layer -- and /api/orders hard-refuses any order
      // missing it. This is the one authenticated chokepoint every order passes
      // through, and the user has just checked all three research-use
      // acknowledgments above, so recording it here is both correct and the
      // point that keeps grid-built carts from being rejected at checkout.
      try {
        await fetch('/api/disclaimer-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layer: 'add_to_cart' }),
        });
      } catch { /* best-effort; /api/orders surfaces a clear error if truly missing */ }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({ id: item.id, quantity: item.quantity, bundleName: item.bundleName })),
          shippingAddress: fulfillmentMethod === 'ship' ? { fullName, street, suite, city, state, zip, phone } : null,
          fulfillmentMethod,
          shippingOption,
          paymentMethod,
          couponCode: couponDisabled ? null : (appliedCoupon?.code || null),
          idempotencyKey: getIdempotencyKey(),
          agentSlug: agentSlug || null,
        })
      });

      if (!response.ok) {
        let errStr = 'Failed To Process Order.';
        try { 
          const data = await response.json(); 
          errStr = data.error ?? errStr; 
        } catch { 
          // If response is not valid JSON (e.g., 500 HTML page)
          throw new Error('Failed to process order. The server encountered an unexpected error.');
        }
        throw new Error(errStr);
      }

      const data = await response.json();

      if (typeof data.total === 'number') {
        const srv = Number(data.total);
        setServerTotal(srv);
        setTotalAdjusted(Math.abs(srv - grandTotal) > 0.01);
      }
      setOrderSuccess(data.orderId);
      // Funnel analytics (best-effort, non-blocking): order completed.
      // (order_complete is server-emitted, skipped client-side)
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
      case 'zelle': return { label: 'Zelle Payment Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount To: ${handle}. Please Include Your Order ID In The Memo Field.` : 'Contact Your Agent For Zelle Payment Instructions.' };
      case 'cashapp': return { label: 'Cash App Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount To Cash App: ${handle}. Please Reference Your Order ID In Memo.` : 'Contact Your Agent For Cash App Payment Instructions.' };
      case 'venmo': return { label: 'Venmo Payment Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount To Venmo: ${handle}. Please Reference Your Order ID In Memo.` : 'Contact Your Agent For Venmo Payment Instructions.' };
      case 'apple_pay': return { label: 'Apple Pay Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount Via Apple Pay To: ${handle}. Please Reference Your Order ID.` : 'Contact Your Agent For Apple Pay Payment Instructions.' };
      case 'apple_cash': return { label: 'Apple Cash Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount Via Apple Cash To: ${handle}. Please Reference Your Order ID.` : 'Contact Your Agent For Apple Cash Payment Instructions.' };
      case 'paypal': return { label: 'PayPal Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount Via PayPal To: ${handle}. Please Reference Your Order ID In The Note.` : 'Contact Your Agent For PayPal Payment Instructions.' };
      case 'google_wallet': return { label: 'Google Wallet Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount Via Google Wallet To: ${handle}. Please Reference Your Order ID.` : 'Contact Your Agent For Google Wallet Payment Instructions.' };
      case 'wise': return { label: 'Wise Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount Via Wise To: ${handle}. Please Reference Your Order ID.` : 'Contact Your Agent For Wise Payment Instructions.' };
      case 'chime': return { label: 'Chime Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount Via Chime To: ${handle}. Please Reference Your Order ID.` : 'Contact Your Agent For Chime Payment Instructions.' };
      case 'varo': return { label: 'Varo Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount Via Varo To: ${handle}. Please Reference Your Order ID.` : 'Contact Your Agent For Varo Payment Instructions.' };
      default: return { label: 'Payment Details', handle: handle || noHandle, instructions: handle ? `Send Total Amount To: ${handle}. Please Reference Your Order ID.` : 'Contact Your Agent For Payment Instructions.' };
    }
  };

  if (cart.length === 0 && !orderSuccess) {
    return (
      <div className="container-sm section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="glass-panel hover-lift stagger-fade-in" style={{ width: '100%', maxWidth: 500, textAlign: 'center', padding: 'var(--space-8)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 'var(--space-4)', display: 'inline-block' }}>
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Your Shopping Cart Is Empty</h2>
          <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-6)' }}>Add Research Compounds From The Catalog To Proceed.</p>
          <Link href={agentSlug ? `/${agentSlug}` : '/dashboard'} className="btn btn-primary">Browse Catalog</Link>
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
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: '50%', background: 'rgba(192, 184, 168, 0.1)', border: '2px solid var(--teal)', color: 'var(--teal)', marginBottom: 'var(--space-4)', boxShadow: 'var(--shadow-teal-sm)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 role="status" style={{ fontSize: '2rem', color: 'var(--teal)', marginBottom: 'var(--space-2)' }}>Order Placed Successfully</h1>
            <p style={{ color: 'var(--silver)', fontSize: '0.95rem' }}>Your Research Order Has Been Registered And Is Awaiting Offline Payment.</p>
          </div>

          {totalAdjusted && serverTotal !== null && (
            <div className="glass-panel" style={{ background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.15)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p style={{ color: 'var(--teal)', fontWeight: 700, fontSize: '0.88rem', margin: '0 0 4px' }}>Total Was Adjusted</p>
                <p style={{ color: 'var(--silver-light)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
                  Your Confirmed Order Total Is <strong style={{ color: 'var(--teal)' }}>${serverTotal.toFixed(2)}</strong>. Please Send Exactly <strong style={{ color: 'var(--teal)' }}>${serverTotal.toFixed(2)}</strong> To The Payment Handle Below.
                </p>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <span style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Identifier</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: 'var(--white)', fontFamily: 'var(--font-brand)', fontSize: '0.95rem', wordBreak: 'break-all' }}>{orderSuccess}</strong>
                <button
                  type="button"
                  aria-label="Copy Order ID"
                  onClick={() => {
                    navigator.clipboard.writeText(orderSuccess).catch(() => { /* clipboard unavailable */ });
                    setCopiedOrderId(true);
                    setTimeout(() => setCopiedOrderId(false), 2000);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                >
                  {copiedOrderId ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <span style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Method</span>
              <strong style={{ color: 'var(--white)', fontSize: '0.95rem' }}>{PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
              <span style={{ color: 'var(--grey-400)', fontWeight: 600 }}>Amount Due</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>${(serverTotal ?? grandTotal).toFixed(2)}</strong>
                {/* CRO: the amount is transcribed by hand into a payment app -
                    a typo stalls clearance until the agent chases it. One-tap
                    copy removes the most error-prone step at the money moment. */}
                <button
                  type="button"
                  aria-label="Copy Amount Due"
                  onClick={() => {
                    navigator.clipboard.writeText((serverTotal ?? grandTotal).toFixed(2)).catch(() => { /* clipboard unavailable */ });
                    setCopiedAmount(true);
                    setTimeout(() => setCopiedAmount(false), 2000);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                >
                  {copiedAmount ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </span>
            </div>
          </div>

          <div className="glass-panel" style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--teal)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-brand)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--teal)" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>{' '}
              {payment.label}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '1.25rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)', letterSpacing: '0.05em', background: 'rgba(0, 240, 255, 0.05)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0, 240, 255, 0.1)', textAlign: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span style={{ wordBreak: 'break-all' }}>{payment.handle}</span>
              {/* CRO: one-tap copy at the single most failure-prone step of the
                  funnel - transcribing the payment handle into another app. */}
              {payment.handle !== 'Contact Your Agent For Handle' && (
                <button
                  type="button"
                  aria-label="Copy Payment Handle"
                  onClick={() => {
                    navigator.clipboard.writeText(payment.handle).catch(() => { /* clipboard unavailable */ });
                    setCopiedHandle(true);
                    setTimeout(() => setCopiedHandle(false), 2000);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', flexShrink: 0 }}
                >
                  {copiedHandle ? <Check size={18} /> : <Copy size={18} />}
                </button>
              )}
            </div>
            <p style={{ color: 'var(--silver-light)', fontSize: '0.88rem', margin: 0, lineHeight: 1.6 }}>{payment.instructions}</p>
          </div>

          <PaymentProofUpload orderId={orderSuccess} />

          <div className="glass-panel" style={{ background: 'rgba(229, 62, 62, 0.05)', border: '1px solid rgba(229, 62, 62, 0.15)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)' }}>
            <h3 style={{ color: 'var(--red)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: 'var(--font-brand)' }}>Strict Legal Reminder</h3>
            <p style={{ color: 'var(--silver-light)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>All Products Purchased Are Restrictively Designated For Laboratory Experimentation And Chemical Analysis Only. Any Therapeutic Use Or Human Consumption Is Stringently Prohibited.</p>
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
            <Link href={`/orders/${orderSuccess}`} className="btn-neon-cyan" style={{ minWidth: 200, display: 'inline-block', lineHeight: '42px', textDecoration: 'none' }}>
              View Order Status
            </Link>
            <Link href={agentSlug ? `/${agentSlug}` : '/dashboard'} className="btn" style={{ minWidth: 200, display: 'inline-block', lineHeight: '42px', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
              Return To Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-container page-transition" style={{ padding: 'var(--space-6)', maxWidth: 1200, margin: '0 auto', paddingBottom: '100px' }}>
      
      {!meetsOverallMin && totalCartQty > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', color: '#fca5a5', textAlign: 'center' }}>
          <strong>Order Minimum Not Met:</strong> This Storefront Requires An Overall Minimum Order Of {minOverallQty} Items. You Currently Have {totalCartQty} Item{totalCartQty !== 1 ? 's' : ''} In Your Cart.
          {/* CRO: the banner told users to go back but gave them no way to -
              a dead-end error state at the top of the funnel. */}
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Link href={agentSlug ? `/${agentSlug}` : '/dashboard'} className="btn" style={{ display: 'inline-block', padding: '8px 20px', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 'var(--radius-md)', color: 'var(--white)', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem' }}>
              Return To Store To Add Items
            </Link>
          </div>
        </div>
      )}

      <CartWarnings productIds={cart.map((item) => item.id)} />

      {cartIsStale && (
        <div style={{ background: 'rgba(248, 113, 113, 0.07)', border: '1px solid rgba(248, 113, 113, 0.35)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{ fontSize: '0.82rem', color: '#F87171', margin: 0 }}>
            <strong>Your Cart Prices May Be Outdated.</strong> This Cart Was Loaded More Than 24 Hours Ago. Return To The Storefront To Refresh Prices Before Completing Your Order.
          </p>
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
        <h1 className="animated-gradient-text" style={{ fontSize: 'clamp(1.4rem, 5vw, 2.2rem)', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>Secure Order Checkout</h1>
        <p style={{ color: 'var(--silver)' }}>Complete Your Compliance Steps To Register Your Research Request.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-8)', flexWrap: 'wrap' }}>
        {[{ num: 1, label: 'Fulfillment' }, { num: 2, label: 'Billing' }, { num: 3, label: 'Compliance' }].map((s) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: 'var(--font-brand)', fontSize: '0.88rem', background: step === s.num ? 'var(--teal)' : step > s.num ? 'rgba(192, 184, 168, 0.15)' : 'var(--surface-3)', color: step === s.num ? '#fff' : step > s.num ? 'var(--teal)' : 'var(--silver-dark)', border: step >= s.num ? '1px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)', boxShadow: step === s.num ? 'var(--shadow-teal-sm)' : 'none', transition: 'all 0.3s ease' }}>{s.num}</div>
            <span>{s.label}</span>
            {s.num < 3 && <div style={{ width: 40, height: 1, background: step > s.num ? 'var(--teal)' : 'rgba(255, 255, 255, 0.1)', margin: '0 8px' }} />}
          </div>
        ))}
      </div>

      <div className="checkout-grid">
        <style>{`
          .fulfillment-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important; gap: var(--space-4) !important; }
          .step-buttons { display: flex; justify-content: space-between; margin-top: var(--space-4); gap: 10px; }
          .step-buttons.right { justify-content: flex-end; }
          @media (max-width: 768px) {
            .checkout-grid { grid-template-columns: 1fr !important; }
            .checkout-grid > :last-child { order: -1; }
            .fulfillment-grid, .payment-grid { grid-template-columns: 1fr !important; }
            .address-city-grid { grid-template-columns: 2fr 1.2fr 1.2fr !important; }
            .coupon-row { flex-direction: column !important; }
            .coupon-row input { width: 100% !important; }
            .coupon-row button { width: 100% !important; padding: 10px !important; }
            .step-buttons { flex-direction: column-reverse; }
            .step-buttons button { width: 100% !important; min-width: unset !important; }
          }
          @media (max-width: 400px) { .address-city-grid { grid-template-columns: 1fr !important; } }
          .premium-input { background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--white); border-radius: 8px; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3); transition: all 0.2s ease; }
          .premium-input:focus { border-color: rgba(255, 255, 255, 0.3); box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 0 3px rgba(255, 255, 255, 0.05); background: rgba(0, 0, 0, 0.6); }
        `}</style>
        <div className="glass-panel hover-lift stagger-fade-in" style={{ width: '100%' }}>
          <div style={{ padding: 'var(--space-6)' }}>
          {error && (
            <div ref={errorBannerRef} style={{ borderLeft: '3px solid var(--red)', background: 'var(--red-bg)', padding: 'var(--space-4)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p style={{ color: 'var(--red)', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                  <h2 id="fulfillment-method-heading" style={{ color: 'var(--teal)', fontSize: '1.2rem', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)' }}>Fulfillment Method</h2>
                  <div className="fulfillment-grid" role="radiogroup" aria-labelledby="fulfillment-method-heading">
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: shippingOption === 'agent_pickup' ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)', border: shippingOption === 'agent_pickup' ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer', boxShadow: shippingOption === 'agent_pickup' ? 'var(--shadow-teal-sm)' : 'none', transition: 'all 0.25s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="radio" name="shippingOption" checked={shippingOption === 'agent_pickup'} onChange={() => { setShippingOption('agent_pickup'); setFulfillmentMethod('agent_pickup'); }} style={{ accentColor: 'var(--teal)' }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--white)', fontSize: '0.95rem', lineHeight: '1.2' }}>Free Shipping To Agent</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: '2px' }}>7-10 Days</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2DD4BF' }}>Free</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', paddingLeft: 22 }}>Zero Cost Shipping To Your Referring Representative. Coordinate Pickup Directly.</span>
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: shippingOption === 'fedex' ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)', border: shippingOption === 'fedex' ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer', boxShadow: shippingOption === 'fedex' ? 'var(--shadow-teal-sm)' : 'none', transition: 'all 0.25s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="radio" name="shippingOption" checked={shippingOption === 'fedex'} onChange={() => { setShippingOption('fedex'); setFulfillmentMethod('ship'); }} style={{ accentColor: 'var(--teal)' }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--white)', fontSize: '0.95rem', lineHeight: '1.2' }}>FedEx - UPS</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: '2px' }}>6-9 Days</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--teal)' }}>${getShippingCost('fedex', totalWeightOz).toFixed(2)}</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', paddingLeft: 22 }}>Fast Shipping. Base Rate Is $80 For The First 500g, Plus $10 For Each Additional 500g.</span>
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: shippingOption === 'usps' ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)', border: shippingOption === 'usps' ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer', boxShadow: shippingOption === 'usps' ? 'var(--shadow-teal-sm)' : 'none', transition: 'all 0.25s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="radio" name="shippingOption" checked={shippingOption === 'usps'} onChange={() => { setShippingOption('usps'); setFulfillmentMethod('ship'); }} style={{ accentColor: 'var(--teal)' }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--white)', fontSize: '0.95rem', lineHeight: '1.2' }}>USPS International</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: '2px' }}>12-18 Days</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--teal)' }}>${getShippingCost('usps', totalWeightOz).toFixed(2)}</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', paddingLeft: 22 }}>Cheaper Shipping. Base Rate Is $40 For The First 500g, Plus $10 For Each Additional 500g.</span>
                    </label>
                  </div>
                </div>

                {fulfillmentMethod === 'ship' && (
                  <div>
                    <h2 style={{ color: 'var(--teal)', fontSize: '1.2rem', marginBottom: 'var(--space-2)', paddingBottom: 'var(--space-2)' }}>Shipping Delivery Address</h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>All Fields Are Required Unless Marked Optional.</p>
                    {!savedAddressesLoading && savedAddresses.length > 0 && (
                      <div style={{ marginBottom: 'var(--space-5)' }}>
                        <span className="form-label" id="saved-addresses-heading" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Saved Addresses</span>
                        <div role="radiogroup" aria-labelledby="saved-addresses-heading" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                          {savedAddresses.map((a) => (
                            <label key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: selectedAddressId === a.id ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)', border: selectedAddressId === a.id ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}>
                              <input type="radio" name="savedAddress" checked={selectedAddressId === a.id} onChange={() => pickSavedAddress(a.id)} style={{ accentColor: 'var(--teal)', marginTop: 4 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.88rem', color: 'var(--white)', fontWeight: 600 }}>
                                  {a.label || a.full_name}
                                  {a.is_default && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--teal)', fontWeight: 700 }}>Default</span>}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 2 }}>{a.street1}{a.street2 ? `, ${a.street2}` : ''}, {a.city}, {a.state} {a.zip}</div>
                              </div>
                            </label>
                          ))}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: selectedAddressId === 'new' ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)', border: selectedAddressId === 'new' ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}>
                            <input type="radio" name="savedAddress" checked={selectedAddressId === 'new'} onChange={() => pickSavedAddress('new')} style={{ accentColor: 'var(--teal)' }} />
                            <span style={{ fontSize: '0.88rem', color: 'var(--white)', fontWeight: 600 }}>Use A New Address</span>
                          </label>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="ship-fullname">Full Name</label>
                        <input id="ship-fullname" type="text" className="form-input premium-input" placeholder="First And Last Name" autoComplete="name" autoCapitalize="words" required aria-required="true" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                      </div>
                      <div className="grid-2">
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label" htmlFor="ship-street">Street Address</label>
                          <AddressAutocompleteInput id="ship-street" className="form-input premium-input" placeholder="123 Lab Street" value={street} onChange={setStreet} onSelect={(a) => { setStreet(a.street1); if (a.city) setCity(a.city); if (a.state) setState(a.state); if (a.zip) setZip(a.zip); }} />
                        </div>
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label" htmlFor="ship-suite" style={{ whiteSpace: 'nowrap' }}>Suite Or Apartment</label>
                          <input id="ship-suite" type="text" className="form-input premium-input" placeholder="Suite 404 (Optional)" autoComplete="address-line2" value={suite} onChange={(e) => setSuite(e.target.value)} />
                        </div>
                      </div>
                      <div className="address-city-grid">
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label" htmlFor="ship-city">City</label>
                          <input id="ship-city" type="text" className="form-input premium-input" placeholder="Science City" autoComplete="address-level2" autoCapitalize="words" required aria-required="true" value={city} onChange={(e) => setCity(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label" htmlFor="ship-state">State</label>
                          <select id="ship-state" className="form-input premium-input" autoComplete="address-level1" required aria-required="true" value={state} onChange={(e) => setState(e.target.value)}>
                            <option value="">Select State</option>
                            {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginTop: 0 }}>
                          <label className="form-label" htmlFor="ship-zip">Zip Code</label>
                          <input id="ship-zip" type="text" className="form-input premium-input" placeholder="90210" inputMode="numeric" pattern="[0-9]*" maxLength={10} autoComplete="postal-code" required aria-required="true" value={zip} onChange={(e) => setZip(e.target.value)} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="ship-phone">Phone Number (Optional)</label>
                        <input id="ship-phone" type="tel" className="form-input premium-input" placeholder="123-456-7890 (For Shipping Updates)" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </div>
                      {selectedAddressId === 'new' && (
                        <label className="form-checkbox" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--surface-2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)' }}>
                          <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                          <span style={{ fontSize: '0.84rem', color: 'var(--silver-light)' }}>Save This Address To My Account For Future Orders.</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {fulfillmentMethod === 'agent_pickup' && (
                  <div style={{ background: 'rgba(192, 184, 168, 0.03)', border: '1px solid rgba(192, 184, 168, 0.2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                    <h3 style={{ color: 'var(--teal)', fontSize: '0.95rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)' }}>Agent Hand-Off Confirmation</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--silver-light)', margin: 0, lineHeight: 1.6 }}>You Have Opted For Manual In-Person Pickup. No Package Shipping Fee Will Be Charged. Please Arrange Coordinates With Your Local Partner Following Order Placement.</p>
                  </div>
                )}

                <div className="step-buttons">
                  <Link href={agentSlug ? `/${agentSlug}` : '/'} className="btn-neon-cyan" style={{ minWidth: 200, padding: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Back To Store</Link>
                  <button type="button" onClick={handleNextStep} className="btn-neon-cyan" style={{ minWidth: 150, opacity: meetsOverallMin ? 1 : 0.5, cursor: meetsOverallMin ? 'pointer' : 'not-allowed' }} disabled={!meetsOverallMin}>Continue To Payment</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                  <h2 id="payment-method-heading" style={{ color: 'var(--teal)', fontSize: '1.2rem', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)' }}>Billing Offline Payment Method</h2>
                  <p style={{ color: 'var(--silver-light)', fontSize: '0.85rem', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>Select Your Preferred Offline Channel To Finalize Cash Settlement. Our Staff Will Release Your Lab Experimentation Order Instantly Upon Verifying Receipt.</p>
                  <div className="payment-grid" role="radiogroup" aria-labelledby="payment-method-heading">
                    {availablePaymentMethods.map((p) => (
                      <label key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: paymentMethod === p.id ? 'rgba(192, 184, 168, 0.06)' : 'var(--surface-2)', border: paymentMethod === p.id ? '2px solid var(--teal)' : '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer', boxShadow: paymentMethod === p.id ? 'var(--shadow-teal-sm)' : 'none', transition: 'all 0.25s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <input type="radio" name="paymentMethod" checked={paymentMethod === p.id} onChange={() => setPaymentMethod(p.id)} style={{ accentColor: 'var(--teal)', flexShrink: 0 }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 48, flexShrink: 0 }}>{p.icon}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap', overflow: 'hidden' }}>
                              <strong style={{ color: 'var(--white)', fontSize: '1.05rem', fontFamily: 'var(--font-brand)', margin: 0, padding: 0, lineHeight: 1, whiteSpace: 'nowrap' }}>{p.name}</strong>
                              {agentPaymentHandles?.[p.id] && (
                                <><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1rem', lineHeight: 1 }}>-</span><span style={{ fontSize: '0.95rem', color: 'var(--silver)', lineHeight: 1, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentPaymentHandles[p.id]}</span></>
                              )}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                  <h3 style={{ color: 'var(--silver-light)', fontSize: '0.88rem', marginBottom: 'var(--space-2)' }}>Payment Process Notice</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0, lineHeight: 1.5 }}>Your Checkout Complete Order ID Will Be Displayed Following Submission. Simply Complete Payment Settlement Via The Listed Handle And Input Your Order ID In The Payment Reference.</p>
                </div>
                <div className="step-buttons">
                  <button type="button" onClick={handlePrevStep} className="btn" style={{ minWidth: 150, background: 'rgba(255,255,255,0.05)', color: 'var(--white)' }}>Back</button>
                  <button type="button" onClick={handleNextStep} className="btn-neon-cyan" style={{ minWidth: 150 }}>Continue To Terms</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div>
                  <h2 style={{ color: 'var(--red)', fontSize: '1.2rem', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)' }}>Compliance Research Agreement</h2>
                  <p style={{ color: 'var(--silver-light)', fontSize: '0.85rem', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>Please Review And Attest To All Compliance Agreements Below. Your Strict Lab Affirmations Are Stored In Audited Database Ledgers For Mandatory Safety Protocols.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    <label className="form-checkbox" style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)' }}>
                      <input type="checkbox" checked={disclaimer1} onChange={(e) => setDisclaimer1(e.target.checked)} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--silver-light)', lineHeight: 1.5 }}>I Acknowledge That All Products Ordered Are Intended For Lab Research Use Only.</span>
                    </label>
                    <label className="form-checkbox" style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)' }}>
                      <input type="checkbox" checked={disclaimer2} onChange={(e) => setDisclaimer2(e.target.checked)} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--silver-light)', lineHeight: 1.5 }}>I Understand That These Compounds Are Not Approved For Human Ingestion Or Consumption.</span>
                    </label>
                    <label className="form-checkbox" style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)' }}>
                      <input type="checkbox" checked={disclaimer3} onChange={(e) => setDisclaimer3(e.target.checked)} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--silver-light)', lineHeight: 1.5 }}>I Certify That The Research Facility Meets All Necessary Safety And Compliance Standards.</span>
                    </label>
                  </div>
                </div>
                <div style={{ borderLeft: '3px solid var(--red)', background: 'var(--red-bg)', padding: 'var(--space-4)', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
                  <h3 style={{ color: 'var(--red)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: 'var(--font-brand)' }}>Binding Attestation</h3>
                  <p style={{ color: 'var(--silver-light)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>Acceptance Of These Agreements Digitally Validates Your Institutional Consent. False Audits May Result In Restrictive Ban Of Profile Access To All Catalog Inventory.</p>
                </div>

                {/* End-of-checkout BAC water reminder: reviews the order, states
                    the calculated amount needed for the WHOLE order, and adds the
                    suggested quantity in one click. Hidden once covered,
                    dismissed, or when no reconstitution vials are in the cart. */}
                {neededBacWaterVials > 0 && bacProduct && !bacReminderDismissed && (
                  <div role="status" style={{ background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.35)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', boxShadow: '0 0 18px rgba(0,196,188,0.10)' }}>
                    <strong style={{ display: 'block', color: 'var(--white)', fontSize: '0.85rem', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Wait — Does Your Lab Have BAC Water?</strong>
                    <p style={{ color: 'var(--silver-light)', fontSize: '0.8rem', margin: '0 0 12px', lineHeight: 1.5 }}>
                      We Reviewed Your Order: <strong style={{ color: 'var(--white)' }}>{bacPeptideVials}</strong> Research Vial{bacPeptideVials !== 1 ? 's' : ''} Require{bacPeptideVials === 1 ? 's' : ''} Bacteriostatic Water For Reconstitution{currentBacWaterVials > 0 ? <> And Your Cart Currently Includes <strong style={{ color: 'var(--white)' }}>{currentBacWaterVials}</strong> BAC Water Vial{currentBacWaterVials !== 1 ? 's' : ''}</> : ', And Your Cart Has None'}. Suggested Amount For This Order: <strong style={{ color: 'var(--white)' }}>{neededBacWaterVials}</strong> Vial{neededBacWaterVials !== 1 ? 's' : ''}{bacProduct.unitSize ? ` (${bacProduct.unitSize}${bacProduct.unitMeasure || 'ml'} Each)` : ''}.
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => { setBacAddedQty(neededBacWaterVials); handleAddBacWater(); }}
                        className="btn-neon-cyan"
                        style={{ flex: '1 1 230px', padding: '11px 14px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 6, cursor: 'pointer' }}
                      >
                        Add {neededBacWaterVials} BAC Water Vial{neededBacWaterVials !== 1 ? 's' : ''} — ${((isAgentSelfBuy ? bacProduct.costPrice : bacProduct.retailPrice) * neededBacWaterVials).toFixed(2)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBacReminderDismissed(true)}
                        style={{ flex: '0 1 auto', padding: '11px 14px', fontSize: '0.78rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: 'var(--silver)', borderRadius: 6, cursor: 'pointer' }}
                      >
                        My Lab Is Covered
                      </button>
                    </div>
                  </div>
                )}
                {bacAddedQty > 0 && neededBacWaterVials === 0 && (
                  <div role="status" style={{ background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', color: '#2DD4BF', fontSize: '0.8rem', fontWeight: 600 }}>
                    {bacAddedQty} Vial{bacAddedQty !== 1 ? 's' : ''} Of Bacteriostatic Water Added To Your Order.
                  </div>
                )}

                {/* Acetic-acid parity: GLP-1/IGF-class vials reconstitute with
                    acetic acid, not BAC water. Same end-of-checkout treatment. */}
                {neededAceticAcidVials > 0 && aceticProduct && !aceticReminderDismissed && (
                  <div role="status" style={{ background: 'rgba(235,178,54,0.05)', border: '1px solid rgba(235,178,54,0.32)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                    <strong style={{ display: 'block', color: 'var(--white)', fontSize: '0.85rem', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Acetic Acid Check</strong>
                    <p style={{ color: 'var(--silver-light)', fontSize: '0.8rem', margin: '0 0 12px', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--white)' }}>{aceticPeptideVials}</strong> Vial{aceticPeptideVials !== 1 ? 's' : ''} In Your Order Reconstitute{aceticPeptideVials === 1 ? 's' : ''} With Acetic Acid 0.6% Instead Of BAC Water. Suggested: <strong style={{ color: 'var(--white)' }}>{neededAceticAcidVials}</strong> Vial{neededAceticAcidVials !== 1 ? 's' : ''}.
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => { setAceticAddedQty(neededAceticAcidVials); handleAddAceticAcid(); }}
                        style={{ flex: '1 1 230px', padding: '11px 14px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '1px solid #EBB236', color: '#EBB236' }}
                      >
                        Add {neededAceticAcidVials} Acetic Acid Vial{neededAceticAcidVials !== 1 ? 's' : ''} — ${((isAgentSelfBuy ? aceticProduct.costPrice : aceticProduct.retailPrice) * neededAceticAcidVials).toFixed(2)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAceticReminderDismissed(true)}
                        style={{ flex: '0 1 auto', padding: '11px 14px', fontSize: '0.78rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: 'var(--silver)', borderRadius: 6, cursor: 'pointer' }}
                      >
                        My Lab Is Covered
                      </button>
                    </div>
                  </div>
                )}
                {aceticAddedQty > 0 && neededAceticAcidVials === 0 && (
                  <div role="status" style={{ background: 'rgba(235,178,54,0.07)', border: '1px solid rgba(235,178,54,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', color: '#EBB236', fontSize: '0.8rem', fontWeight: 600 }}>
                    {aceticAddedQty} Vial{aceticAddedQty !== 1 ? 's' : ''} Of Acetic Acid Added To Your Order.
                  </div>
                )}

                <div className="step-buttons">
                  <button type="button" onClick={handlePrevStep} className="btn" style={{ minWidth: 150, background: 'rgba(255,255,255,0.05)', color: 'var(--white)' }} disabled={loading}>Back</button>
                  <button type="submit" className="btn-neon-cyan" style={{ minWidth: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={loading} aria-busy={loading}>
                    {loading ? <><span aria-hidden="true" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /><span className="sr-only">Placing Order</span></> : 'Place Research Order'}
                  </button>
                </div>
              </div>
            )}
          </form>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="glass-panel">
            <div style={{ padding: 'var(--space-5)' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--white)', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Order Inventory</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: 220, overflowY: 'auto', paddingRight: 4, marginBottom: 'var(--space-4)' }}>
              {(() => {
                const groupedCart: { isBundle: boolean, name: string, items: typeof cart }[] = [];
                const processedIds = new Set<string>();
                cart.forEach(item => {
                  const key = item.id + '-' + (item.bundleName || '');
                  if (processedIds.has(key)) return;
                  if (item.bundleName) {
                    const bundleItems = cart.filter(i => i.bundleName === item.bundleName);
                    if (!groupedCart.find(g => g.isBundle && g.name === item.bundleName)) groupedCart.push({ isBundle: true, name: item.bundleName, items: bundleItems });
                    bundleItems.forEach(i => processedIds.add(i.id + '-' + i.bundleName));
                  } else {
                    groupedCart.push({ isBundle: false, name: item.name, items: [item] });
                    processedIds.add(key);
                  }
                });
                return groupedCart.map((group, groupIndex) => {
                  if (group.isBundle) {
                    const bundleSubtotal = group.items.reduce((acc, item) => { const bulkEligible = !isAgentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold; const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice; return acc + activePrice * item.quantity; }, 0);
                    return (
                      <div key={`bundle-${group.name}-${groupIndex}`} style={{ background: 'rgba(0,196,188, 0.03)', border: '1px solid rgba(0,196,188, 0.2)', borderRadius: 8, padding: '10px', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,196,188,0.1)', paddingBottom: 6, marginBottom: 4 }}>
                          <div>
                            <h3 style={{ fontSize: '0.85rem', margin: 0, fontFamily: 'var(--font-brand)', color: '#00C4BC' }}>{group.name}</h3>
                            <div style={{ fontSize: '0.65rem', color: '#2DD4BF', marginTop: 2, fontWeight: 700 }}>Bundle Price Applied</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--grey-400)', marginTop: 4, fontStyle: 'italic', maxWidth: '90%' }}>Note: This peptide stack is not all inside one vial, it is individually packaged as the vials listed below.</div>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#00C4BC', fontWeight: 800 }}>${bundleSubtotal.toFixed(2)}</div>
                        </div>
                        {group.items.map(item => { const bulkEligible = !isAgentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold; const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice; return (<div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', alignItems: 'flex-start', paddingLeft: 6 }}><div style={{ flexGrow: 1, paddingRight: 'var(--space-3)' }}><span style={{ color: 'var(--silver-light)', fontWeight: 500 }}>&#x21B3; {toTitleCase(item.name)}</span><div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>Qty: {item.quantity}</div></div><div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong style={{ color: '#00C4BC' }}>${(activePrice * item.quantity).toFixed(2)}</strong></div></div>); })}
                      </div>
                    );
                  }
                  return group.items.map(item => { const retail = (item as any).retailPrice ?? item.costPrice; const showDiscount = isAgentSelfBuy && retail > item.costPrice; const bulkEligible = !isAgentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold; const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice; return (<div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', alignItems: 'flex-start', marginBottom: 4 }}><div style={{ flexGrow: 1, paddingRight: 'var(--space-3)' }}><span style={{ color: 'var(--white)', fontWeight: 500 }}>{toTitleCase(item.name)}</span><div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>Qty: {item.quantity}</div></div><div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{showDiscount && <div style={{ color: 'var(--grey-500)', fontSize: '0.70rem', textDecoration: 'line-through' }}>${(retail * item.quantity).toFixed(2)}</div>}<strong style={{ color: showDiscount ? 'var(--teal)' : 'var(--silver-light)' }}>${(activePrice * item.quantity).toFixed(2)}</strong></div></div>); });
                });
              })()}
            </div>

            {neededBacWaterVials > 0 && bacProduct && (
              <div style={{ background: 'rgba(0, 196, 188, 0.04)', border: '1px solid rgba(0, 196, 188, 0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)', boxShadow: '0 0 15px rgba(0, 196, 188, 0.08)', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong style={{ color: 'var(--white)', fontSize: '0.82rem', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Reconstitution Supplies</strong>
                </div>
                <p style={{ color: 'var(--silver-light)', fontSize: '0.76rem', margin: '0 0 10px', lineHeight: 1.4 }}>Your Order Contains <strong style={{ color: 'var(--white)' }}>{bacPeptideVials}</strong> Research Vial{bacPeptideVials !== 1 ? 's' : ''} Requiring BAC Water. You Need Approximately <strong style={{ color: 'var(--white)' }}>{requiredBacWaterVials}</strong> Vial{requiredBacWaterVials !== 1 ? 's' : ''} Of Bacteriostatic Water.</p>
                <button type="button" onClick={handleAddBacWater} className="btn-neon-cyan" style={{ width: '100%', padding: '8px 12px', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', borderRadius: 6, transition: 'all 0.2s ease' }}>
                  <span>Add {neededBacWaterVials} Vials To Order</span>
                  <strong style={{ color: 'var(--white)' }}>(${((isAgentSelfBuy ? bacProduct.costPrice : bacProduct.retailPrice) * neededBacWaterVials).toFixed(2)})</strong>
                </button>
              </div>
            )}

            {neededAceticAcidVials > 0 && aceticProduct && (
              <div style={{ background: 'rgba(235, 178, 54, 0.04)', border: '1px solid rgba(235, 178, 54, 0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)', boxShadow: '0 0 15px rgba(235, 178, 54, 0.08)', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong style={{ color: 'var(--white)', fontSize: '0.82rem', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Special Reconstitution Supplies</strong>
                </div>
                <p style={{ color: 'var(--silver-light)', fontSize: '0.76rem', margin: '0 0 10px', lineHeight: 1.4 }}>Your Order Contains <strong style={{ color: 'var(--white)' }}>{aceticPeptideVials}</strong> Research Vial{aceticPeptideVials !== 1 ? 's' : ''} Requiring Acetic Acid For Solubility. You Need Approximately <strong style={{ color: 'var(--white)' }}>{requiredAceticAcidVials}</strong> Vial{requiredAceticAcidVials !== 1 ? 's' : ''} Of Acetic Acid 0.6%.</p>
                <button type="button" onClick={handleAddAceticAcid} style={{ width: '100%', padding: '8px 12px', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', borderRadius: 6, transition: 'all 0.2s ease', background: 'transparent', border: '1px solid #EBB236', color: '#EBB236', boxShadow: '0 0 12px rgba(235, 178, 54, 0.25)' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBB236'; e.currentTarget.style.color = '#000000'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#EBB236'; }}>
                  <span>Add {neededAceticAcidVials} Vials To Order</span>
                  <strong style={{ color: 'inherit' }}>(${((isAgentSelfBuy ? aceticProduct.costPrice : aceticProduct.retailPrice) * neededAceticAcidVials).toFixed(2)})</strong>
                </button>
              </div>
            )}

            {!couponDisabled && (
              <div style={{ paddingTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                {appliedCoupon ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
                    <span style={{ fontSize: '0.78rem', color: '#2DD4BF', fontWeight: 600 }}>Coupon {appliedCoupon.code} Applied</span>
                    <button type="button" onClick={removeCoupon} style={{ background: 'none', border: 'none', color: 'var(--grey-400)', fontSize: '0.74rem', cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
                  </div>
                ) : (
                  <div className="coupon-row" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <input type="text" className="form-input premium-input" placeholder="Coupon Code" aria-label="Coupon Code" aria-invalid={couponError ? true : undefined} aria-describedby={couponError ? 'coupon-error' : undefined} value={couponInput} onChange={(e) => setCouponInput(e.target.value)} style={{ margin: 0, flexGrow: 1, fontSize: '0.8rem' }} />
                    <button type="button" onClick={() => applyCoupon()} disabled={couponLoading} className="btn-neon-cyan" style={{ fontSize: '0.78rem', padding: '0 var(--space-4)' }}>{couponLoading ? 'Checking' : 'Apply'}</button>
                  </div>
                )}
                {couponError && <p id="coupon-error" role="alert" style={{ fontSize: '0.72rem', color: 'var(--red)', margin: 'var(--space-2) 0 0' }}>{couponError}</p>}
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
              {volumeDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '6px 10px', background: 'rgba(45,212,191,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(45,212,191,0.2)' }}>
                  <span style={{ color: '#2DD4BF', fontWeight: 600 }}>Volume Discount (3+ Vials Per Peptide)</span>
                  <strong style={{ color: '#2DD4BF' }}>-${volumeDiscount.toFixed(2)}</strong>
                </div>
              )}
              {appliedCoupon && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#2DD4BF' }}>Coupon Discount</span>
                  <strong style={{ color: '#2DD4BF' }}>-${discount.toFixed(2)}</strong>
                </div>
              )}
              {flashDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '6px 10px', background: 'rgba(45,212,191,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(45,212,191,0.2)' }}>
                  <span style={{ color: '#2DD4BF', fontWeight: 600 }}>Flash Sale ({flashSale!.discount_pct}% Off)</span>
                  <strong style={{ color: '#2DD4BF' }}>-${flashDiscount.toFixed(2)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--grey-400)' }}>{shippingCarrier ? shippingCarrier : (shippingOption === 'fedex' ? 'FedEx / UPS Fast' : shippingOption === 'usps' ? 'USPS / China Post Cheap' : 'Fulfillment')}{shippingOption !== 'agent_pickup' && shippingEstimated ? ' (Estimated)' : ''}</span>
                {shippingOption !== 'agent_pickup' ? <strong style={{ color: 'var(--white)' }}>${shippingCost.toFixed(2)}</strong> : <strong style={{ color: 'var(--teal)' }}>Free Shipping To Agent</strong>}
              </div>
              {shippingOption !== 'agent_pickup' && (
                <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textAlign: 'right', marginTop: -4 }}>Total Weight: {totalWeightOz.toFixed(1)} Oz ({(totalWeightOz * 28.3495).toFixed(0)}g)</div>
              )}
              <div style={{ paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', marginTop: 'var(--space-1)' }}>
                <span style={{ color: 'var(--white)', fontWeight: 600 }}>Total Due</span>
                <strong style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>${grandTotal.toFixed(2)}</strong>
              </div>
            </div>
            </div>
          </div>

          <div className="glass-panel">
            <div style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px', flexShrink: 0 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div>
                <h4 style={{ fontSize: '0.78rem', color: 'var(--white)', marginBottom: 2, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Encrypted Ledger Transact</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--grey-400)', margin: 0, lineHeight: 1.4 }}>All Catalog Registrations Are Processed With Cryptographic Integrity In Compliance With Private Bio-Science Regulations.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
