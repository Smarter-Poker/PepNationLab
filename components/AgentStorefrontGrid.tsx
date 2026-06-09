'use client';

import React, { useState, useMemo, useCallback, useEffect, useDeferredValue, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Star, X, Heart, FileText, Search, SlidersHorizontal, RotateCcw, Check, ShoppingCart, ArrowRight, Sparkles, Flame, Zap, Brain, Shield, Hourglass, Moon, Activity, Syringe } from 'lucide-react';
import RecommendationStrip, { type RecommendationItem } from './RecommendationStrip';
import ProductMonograph from './research/ProductMonograph';