'use client';

import React, { useState, useMemo, useCallback, useEffect, useDeferredValue, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Star, X, Heart, FileText, Search, SlidersHorizontal, RotateCcw, Check, ShoppingCart, ArrowRight, Sparkles, Flame, Zap, Brain, Shield, Hourglass, Moon, Activity, Syringe, Wind } from 'lucide-react';
import RecommendationStrip, { type RecommendationItem } from './RecommendationStrip';
import ProductMonograph from './research/ProductMonograph';
import IframeLink from '@/components/ui/IframeLink';
import DiscoveryHero, { type MatchedProduct } from './storefront/StorefrontDiscovery';
import ProductModalEnhancements, { type ModalGroupedProductRef } from './storefront/ProductModalEnhancements';
import StorefrontCompareDrawer from './storefront/StorefrontCompareDrawer';
import DynamicAddToCartButton from './storefront/DynamicAddToCartButton';
import DynamicCartButton from './storefront/DynamicCartButton';
import DynamicDetailButton from './storefront/DynamicDetailButton';
import { evidenceTier, EVIDENCE_TIER, RISK_META, intranasalDisplay, type Compound } from '@/lib/compounds';
import { getProductImage, toTitleCase } from '@/lib/categoryImage';
import PeptideVialCard from '@/components/PeptideVialCard';
import { toast } from 'sonner';
import { writeCatalogCache, isCatalogCacheFresh, readCatalogCache, CATALOG_TTL_MS, evictCatalogCache } from '@/lib/storefront-cache';
import { createClient } from '@/lib/supabase/client';
import { getPopularName } from '@/lib/peptide-popular-names';

// PLACEHOLDER - file too large to push inline. See local file at components/AgentStorefrontGrid.tsx
export default function AgentStorefrontGrid() { return null; }
