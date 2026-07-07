'use client';

/**
 * CompareTool - Phase 2
 * Full side-by-side comparison tool with:
 * - 5 tabs: Matrix | Pros & Cons | Analyst Brief | Mechanism | Protocol
 * - Weighted scoring engine (0–100) with animated score rings
 * - Auto-generated Pros/Cons with severity tiers and category grouping
 * - Deep Analyst Brief with mechanism, stack, and protocol paragraphs
 * - Mechanism deep-dive tab with receptor targets, risk_reasons, sources
 * - Protocol tab with reconstitution, frequency, shelf-life, handling
 * - Efficacy_scores heatmap visualization
 * - Recommendation engine: "Which should I choose?" verdict card
 * - Popular Comparisons quick-start suggestions
 * - Expanded synergy/conflict engine (25+ pairs)
 * - Animated radar (7 axes) with hover tooltips
 * - JSON + CSV export, print, share
 */

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import IframeModal from '@/components/ui/IframeModal';
import Image from 'next/image';
import {
  Search, X, PlusCircle, Check, Printer, Share2, Download,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft, GripHorizontal,
  ThumbsUp, ThumbsDown, Trophy, AlertTriangle, Info,
  Zap, BookOpen, FlaskConical, Shield, Star,
  Clock, Thermometer, ArrowRight, BarChart3, Beaker,
  Scale, Syringe, Wrench, Hourglass, Filter, List, Smartphone, LayoutList, MoveUp, MoveDown,
  Sparkles, Moon, Heart, Brain, FileText, Mic, ShoppingCart, Crosshair, Target, ImageIcon, ShieldAlert
} from 'lucide-react';
import { type Compound, evidenceTier, researchAreaLabel, RISK_META, calculateStackSynergy, intranasalDisplay } from '@/lib/compounds';
import AttributeRadarChart, { type RadarDataPoint } from './AttributeRadarChart';
import InCellGlossaryTooltip from './InCellGlossaryTooltip';
import type { AreaProduct } from '@/lib/area-products-server';
import ResearchCartButton from './ResearchCartButton';
import { useCart } from '@/components/CartContext';

const MAX_COLUMNS = 4;
const NL = 'Not Listed';

// PLACEHOLDER