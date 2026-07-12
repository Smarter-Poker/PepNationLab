'use client';

import { useState, useTransition, useEffect, useMemo, useRef, useCallback } from 'react';
import SmartStackBuilder from '@/components/researcher/SmartStackBuilder';
import { Heart, Trash2, ExternalLink, PackageOpen, History, LayoutGrid, List as ListIcon, Search, X, Check, ShoppingCart, Info, TrendingUp, TrendingDown, XCircle, Layers, FlaskConical, Zap, Target, Activity, Calendar, Syringe, Flame, Clock, Droplet, MapPin, Repeat, ChevronRight, Beaker, Gauge, Camera, Bell, BellOff } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { getProductImage } from '@/lib/categoryImage';
import DynamicAddToCartButton from '@/components/storefront/DynamicAddToCartButton';
import { reportClientError } from '@/lib/report-client-error';

// recharts (~400KB) is code-split: the default 'bundles' tab renders no charts,
// so most Lab Journal visits never download it.
const BiometricTrendChart = dynamic(() => import('@/components/lab-journal/LabJournalCharts').then((m) => m.BiometricTrendChart), { ssr: false, loading: () => <div style={{ width: '100%', height: '100%' }} aria-hidden="true" /> });
const BiometricDoseOverlayChart = dynamic(() => import('@/components/lab-journal/LabJournalCharts').then((m) => m.BiometricDoseOverlayChart), { ssr: false, loading: () => <div style={{ width: '100%', height: '100%' }} aria-hidden="true" /> });
const AdherenceRing = dynamic(() => import('@/components/lab-journal/LabJournalCharts').then((m) => m.AdherenceRing), { ssr: false, loading: () => <div style={{ width: '100%', height: '100%' }} aria-hidden="true" /> });
const ActiveInSystemChart = dynamic(() => import('@/components/lab-journal/LabJournalCharts').then((m) => m.ActiveInSystemChart), { ssr: false, loading: () => <div style={{ width: '100%', height: '100%' }} aria-hidden="true" /> });
const MetricSparkline = dynamic(() => import('@/components/lab-journal/LabJournalCharts').then((m) => m.MetricSparkline), { ssr: false, loading: () => <div style={{ width: '100%', height: '100%' }} aria-hidden="true" /> });

interface Item {
  product_id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  base_cost: number | null;
  retail_price: number | null;
  in_stock: boolean | null;
  unit_size: string | null;
  unit_measure: string | null;
  last_purchased_date?: string;
  purchase_count?: number;
  viewed_at?: string;
  is_on_sale?: boolean;
  agent_product_id?: string | null;
}

interface Props {
  favorites: Item[];
  pastOrders: Item[];
  recentlyViewed: Item[];
  bundles: Item[];
  catalog: Item[];
  trending: Item[];
  categories: string[];
  storefrontSlug: string | null;
  /** When true the viewer is an agent using the lab journal to add from their own storefront. */
  isAgentSelfBuy?: boolean;
}

const GOAL_MAPPINGS: Record<string, string[]> = {
  'Muscle Growth': ['CJC-1295', 'Ipamorelin', 'IGF-1 LR3', 'Tesamorelin'],
  'Fat Loss': ['Tirzepatide', 'Semaglutide', 'Retatrutide', 'AOD-9604', 'Tesofensine', 'Cagrilintide'],
  'Healing & Recovery': ['BPC-157', 'TB-500'],
  'Anti-Aging': ['Epitalon', 'GHK-Cu', 'NAD+', 'MOTS-c'],
  'Cognitive Enhancement': ['Dihexa', 'Semax', 'Selank'],
};

const PROTOCOL_TEMPLATES = [
  { name: 'Standard BPC-157 Tissue Repair', compound: 'BPC-157', amount: '250', unit: 'mcg', frequency: 'Every Day' },
  { name: 'Standard TB-500 Recovery', compound: 'TB-500', amount: '2.5', unit: 'mg', frequency: 'Twice Weekly' },
  { name: 'Wolverine Stack (BPC-157 + TB-500)', compound: 'BPC-157/TB-500 Blend', amount: '500', unit: 'mcg', frequency: 'Every Day' },
  { name: 'GLP-1 Starter (Tirzepatide)', compound: 'Tirzepatide', amount: '2.5', unit: 'mg', frequency: 'Once Weekly' },
  { name: 'GLP-1 Starter (Semaglutide)', compound: 'Semaglutide', amount: '0.25', unit: 'mg', frequency: 'Once Weekly' },
  { name: 'GHK-Cu Skin/Hair', compound: 'GHK-Cu', amount: '2', unit: 'mg', frequency: 'Every Day' },
  { name: 'Ipamorelin / CJC-1295 Anti-Aging', compound: 'Ipamorelin/CJC-1295', amount: '100', unit: 'mcg', frequency: '5 Days On, 2 Off' }
];

// Estimated elimination half-lives (hours) for the informational "Active In System" model.
// Values are approximate literature figures for research context only.
const HALF_LIFE_HOURS: Record<string, number> = {
  'bpc-157': 4, 'bpc157': 4, 'tb-500': 44, 'tb500': 44, 'thymosin': 44,
  'cjc-1295': 144, 'cjc1295': 144, 'cjc-1295 no dac': 0.5, 'ipamorelin': 2,
  'ghrp': 3, 'sermorelin': 0.2, 'tesamorelin': 0.6, 'hexarelin': 1,
  'semaglutide': 168, 'tirzepatide': 120, 'retatrutide': 144, 'cagrilintide': 180,
  'aod-9604': 0.5, 'tesofensine': 220, 'mots-c': 3, 'nad+': 2, 'nad': 2,
  'epitalon': 1, 'ghk-cu': 0.5, 'ghk': 0.5, 'igf-1 lr3': 20, 'igf-1': 20,
  'dihexa': 10, 'semax': 0.5, 'selank': 0.5, 'melanotan': 36, 'pt-141': 2.7,
  'kisspeptin': 4, 'dsip': 2, 'll-37': 4, 'glutathione': 3,
};

function estimateHalfLifeHours(compound: string): number {
  const key = compound.toLowerCase().trim();
  if (HALF_LIFE_HOURS[key] != null) return HALF_LIFE_HOURS[key];
  // Longest keys first so specific names win; require >= 4 chars for the substring
  // fallback so short keys (e.g. 'nad') do not match unrelated names (e.g. 'gonadorelin').
  const keys = Object.keys(HALF_LIFE_HOURS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length >= 4 && (key.includes(k) || k.includes(key))) return HALF_LIFE_HOURS[k];
  }
  return 24; // conservative default
}

// Curated biometric presets with sensible default units and directional intent.
const BIOMETRIC_PRESETS: { name: string; unit: string; icon: any; better: 'up' | 'down' | 'none' }[] = [
  { name: 'Weight', unit: 'lbs', icon: Gauge, better: 'none' },
  { name: 'Body Fat %', unit: '%', icon: Activity, better: 'down' },
  { name: 'Waist', unit: 'in', icon: Activity, better: 'down' },
  { name: 'Resting HR', unit: 'bpm', icon: Heart, better: 'down' },
  { name: 'Blood Pressure', unit: 'mmHg', icon: Activity, better: 'down' },
  { name: 'HRV', unit: 'ms', icon: Activity, better: 'up' },
  { name: 'Sleep', unit: 'hrs', icon: Clock, better: 'up' },
  { name: 'Sleep Quality', unit: '/10', icon: Clock, better: 'up' },
  { name: 'Energy', unit: '/10', icon: Zap, better: 'up' },
  { name: 'Mood', unit: '/10', icon: Heart, better: 'up' },
  { name: 'Fasting Glucose', unit: 'mg/dL', icon: Droplet, better: 'down' },
  { name: 'Pain Level', unit: '/10', icon: Activity, better: 'down' },
];

const CHART_COLORS = ['#00E5FF', '#F6AD55', '#68D391', '#D6BCFA', '#FC8181', '#63B3ED', '#F687B3'];

function daysBetween(a: number, b: number): number {
  return Math.floor((a - b) / 86400000);
}

function dayKey(d: Date | string | number): string {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function LabJournalClient({ favorites: initialFavorites, pastOrders, recentlyViewed: initialRecentlyViewed, bundles, catalog, trending, categories, storefrontSlug, isAgentSelfBuy = false }: Props) {
  const [favorites, setFavorites] = useState<Item[]>(initialFavorites);
  const [recentlyViewed, setRecentlyViewed] = useState<Item[]>(initialRecentlyViewed);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [helpfulData, setHelpfulData] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [doses, setDoses] = useState<any[]>([]);
  const [biometrics, setBiometrics] = useState<any[]>([]);
  
  // Goals State
  const [goals, setGoals] = useState<any[]>([]);
  const [goalName, setGoalName] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  
  // Notes UI State
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteCompoundSlug, setNoteCompoundSlug] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Intelligence State
  const [intelligenceCompound, setIntelligenceCompound] = useState<string | null>(null);
  const [intelligenceData, setIntelligenceData] = useState<any>(null);

  // AI Protocol State
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [aiCompounds, setAiCompounds] = useState<string[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiExperience, setAiExperience] = useState('Beginner');
  const [aiMetrics, setAiMetrics] = useState('');

  // Dose UI State
  const [doseCompound, setDoseCompound] = useState('');
  const [doseAmount, setDoseAmount] = useState('');
  const [doseUnit, setDoseUnit] = useState('mcg');
  const [doseSaving, setDoseSaving] = useState(false);

  // Biometrics UI State
  const [bioName, setBioName] = useState('');
  const [bioValue, setBioValue] = useState('');
  const [bioUnit, setBioUnit] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [biometricGoals, setBiometricGoals] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pnl_biometric_goals');
      if (saved) setBiometricGoals(JSON.parse(saved));
    } catch {}
  }, []);

  const setGoal = (metric: string, val: number) => {
    if (isNaN(val)) return;
    const updated = { ...biometricGoals, [metric]: val };
    setBiometricGoals(updated);
    try { localStorage.setItem('pnl_biometric_goals', JSON.stringify(updated)); } catch {}
  };
  
  // UX Features State
  const [activeTab, setActiveTab] = useState<'bundles' | 'favorites' | 'recentlyViewed' | 'inventory' | 'compareHistory' | 'notes' | 'doses' | 'biometrics' | 'goals' | 'progress'>('bundles');

  // Progress Photos state
  const [progressPhotos, setProgressPhotos] = useState<any[]>([]);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoDate, setPhotoDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [photoUploading, setPhotoUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'priceAsc' | 'priceDesc' | 'alpha' | 'frequent'>('recent');
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quickViewItem, setQuickViewItem] = useState<Item | null>(null);
  const [localCartIds, setLocalCartIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(24);
  const [isComparing, setIsComparing] = useState(false);

  // Inventory & Calc State
  const [inventoryData, setInventoryData] = useState<Record<string, { on_hand: number, lot: string, expiration: string, recon_mg?: string, recon_ml?: string, recon_dose?: string }>>({});
  const [reconMg, setReconMg] = useState('5');
  const [reconMl, setReconMl] = useState('2');
  const [reconDose, setReconDose] = useState('250');
  const [reconProductId, setReconProductId] = useState<string | null>(null);
  const [qrModalProduct, setQrModalProduct] = useState<string | null>(null);

  const handleReconChange = (field: 'recon_mg' | 'recon_ml' | 'recon_dose', value: string) => {
    if (field === 'recon_mg') setReconMg(value);
    if (field === 'recon_ml') setReconMl(value);
    if (field === 'recon_dose') setReconDose(value);
    
    if (reconProductId) {
      updateInventory(reconProductId, field, value);
    }
  };

  // Scheduler & Injection Sites State
  const [scheduledDoses, setScheduledDoses] = useState<any[]>([]);
  const [scheduleCompound, setScheduleCompound] = useState('');
  const [scheduleAmount, setScheduleAmount] = useState('');
  const [scheduleUnit, setScheduleUnit] = useState('mcg');
  const [scheduleFrequency, setScheduleFrequency] = useState('Every Day');
  const [selectedSite, setSelectedSite] = useState<string>('');

  // Push Notifications State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Frequency label helper
  const freqLabel = (f: string): string => {
    const s = (f || '').toLowerCase();
    if (s.includes('every day') || s.includes('daily')) return 'Take Daily';
    if (s.includes('every other')) return 'Every Other Day';
    if (s.includes('5 days')) return '5 Days On · 2 Off';
    if (s.includes('twice')) return 'Twice Weekly';
    if (s.includes('once') || s.includes('weekly')) return 'Once Weekly';
    return f;
  };

  // Push Notification helpers
  const requestNotifPermission = useCallback(async () => {
    if (!('Notification' in window)) { setNotifPermission('unsupported'); return; }
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      new Notification('PepNationLab Alerts Enabled 🔔', {
        body: 'You will be reminded when a protocol dose is due.',
        icon: '/icon-192.png',
      });
    }
  }, []);

  const sendDoseReminder = useCallback((compoundName: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`⏰ Dose Due: ${compoundName}`, {
        body: `Your protocol schedule shows ${compoundName} is due today. Log your dose in the Lab Journal.`,
        icon: '/icon-192.png',
        tag: `dose-${compoundName}`,
      });
    }
  }, []);

  // Check cart status

  useEffect(() => {
    const checkCart = () => {
      try {
        const storageKey = storefrontSlug ? `pnl_storefront_cart_${storefrontSlug}` : 'pnl_storefront_cart';
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const ids = new Set<string>((parsed.items || []).map((i: any) => i.id));
          setLocalCartIds(ids);
        }
      } catch {}
    };
    checkCart();
    window.addEventListener('storage', checkCart);
    return () => window.removeEventListener('storage', checkCart);
  }, [storefrontSlug]);

  const computedInjectionSites = useMemo(() => {
    const sites: Record<string, number> = {};
    doses.forEach(d => {
      if (d.injection_site && d.dosed_at) {
        const ts = new Date(d.dosed_at).getTime();
        if (!sites[d.injection_site] || ts > sites[d.injection_site]) {
          sites[d.injection_site] = ts;
        }
      }
    });
    return sites;
  }, [doses]);

  // Dose time-range state for charts
  const [doseRange, setDoseRange] = useState<7 | 30 | 90 | 365>(30);
  const [bioRange, setBioRange] = useState<7 | 30 | 90 | 365>(30);
  const [bioMetricFilter, setBioMetricFilter] = useState<string>('');
  const [doseNote, setDoseNote] = useState('');

  // --- Dose analytics ---
  const doseStats = useMemo(() => {
    const now = Date.now();
    const activeCompounds = new Set(doses.map(d => d.compound_slug)).size;
    const last7 = doses.filter(d => daysBetween(now, new Date(d.dosed_at).getTime()) < 7).length;
    const last30 = doses.filter(d => daysBetween(now, new Date(d.dosed_at).getTime()) < 30).length;

    // Streak: consecutive days (ending today or yesterday) with at least one dose.
    const daySet = new Set(doses.map(d => dayKey(d.dosed_at)));
    let streak = 0;
    const cursor = new Date();
    if (!daySet.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (daySet.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Adherence over trailing 30 days from scheduled protocols.
    const perWeekFromFreq = (f: string): number => {
      const s = (f || '').toLowerCase();
      if (s.includes('every day') || s.includes('daily')) return 7;
      if (s.includes('every other')) return 3.5;
      if (s.includes('5 days')) return 5;
      if (s.includes('twice')) return 2;
      if (s.includes('once') || s.includes('weekly')) return 1;
      return 7;
    };
    const expected30 = scheduledDoses.reduce((sum, s) => sum + perWeekFromFreq(s.frequency) * (30 / 7), 0);
    const adherence = expected30 > 0 ? Math.min(100, Math.round((last30 / expected30) * 100)) : null;

    return { total: doses.length, activeCompounds, last7, last30, streak, adherence, expected30: Math.round(expected30) };
  }, [doses, scheduledDoses]);

  // --- Dose calendar heatmap (last ~119 days => 17 weeks) ---
  const calendarWeeks = useMemo(() => {
    const counts: Record<string, number> = {};
    doses.forEach(d => { const k = dayKey(d.dosed_at); counts[k] = (counts[k] || 0) + 1; });
    const weeks: { key: string; count: number; date: Date }[][] = [];
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (16 * 7 + today.getDay()));
    let cur = new Date(start);
    for (let w = 0; w < 17; w++) {
      const col: { key: string; count: number; date: Date }[] = [];
      for (let dow = 0; dow < 7; dow++) {
        const k = dayKey(cur);
        col.push({ key: k, count: counts[k] || 0, date: new Date(cur) });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(col);
    }
    return weeks;
  }, [doses]);

  // --- Active In System concentration model (informational) ---
  const activeInSystem = useMemo(() => {
    const now = Date.now();
    const rangeMs = doseRange * 86400000;
    const windowStart = now - rangeMs;
    const relevant = doses.filter(d => {
      const hl = estimateHalfLifeHours(d.compound_slug) * 3600000;
      // include doses whose influence still matters within window (up to ~6 half-lives before window)
      return new Date(d.dosed_at).getTime() > windowStart - hl * 6;
    });
    const compounds = Array.from(new Set(relevant.map(d => d.compound_slug)));
    if (compounds.length === 0) return { data: [], compounds: [], nowIndex: 0 };

    // Normalize each compound's contribution to a 0-100 scale by its own peak for readability.
    const stepMs = rangeMs / 60; // 60 sample points across window + projection
    const projectMs = 3 * 86400000; // project 3 days forward
    const points: any[] = [];
    for (let t = windowStart; t <= now + projectMs; t += stepMs) {
      const row: any = { t, label: new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }), isFuture: t > now };
      compounds.forEach(c => {
        const hl = estimateHalfLifeHours(c);
        let level = 0;
        relevant.filter(d => d.compound_slug === c).forEach(d => {
          const dt = new Date(d.dosed_at).getTime();
          if (dt <= t) {
            const hoursSince = (t - dt) / 3600000;
            level += Number(d.dose_amount) * Math.pow(0.5, hoursSince / hl);
          }
        });
        row[c] = level;
      });
      points.push(row);
    }
    // Normalize per compound to its peak
    compounds.forEach(c => {
      const peak = Math.max(...points.map(p => p[c] || 0), 0.0001);
      points.forEach(p => { p[c] = Math.round(((p[c] || 0) / peak) * 100); });
    });
    return { data: points, compounds, nowIndex: now };
  }, [doses, doseRange]);

  // --- Week In Review + rule-based Signals (auto-insights) ---
  const weekReview = useMemo(() => {
    const now = Date.now();
    const wk = 7 * 86400000;
    const inWindow = (ts: number, startDaysAgo: number, endDaysAgo: number) =>
      ts <= now - endDaysAgo * 86400000 && ts > now - startDaysAgo * 86400000;

    const dosesThisWeek = doses.filter(d => inWindow(new Date(d.dosed_at).getTime(), 7, 0));
    const dosesLastWeek = doses.filter(d => inWindow(new Date(d.dosed_at).getTime(), 14, 7));

    // Injection site usage this week
    const siteCounts: Record<string, number> = {};
    dosesThisWeek.forEach(d => { if (d.injection_site) siteCounts[d.injection_site] = (siteCounts[d.injection_site] || 0) + 1; });
    const siteEntries = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]);
    const topSite = siteEntries[0] || null;
    const totalSited = siteEntries.reduce((s, [, n]) => s + n, 0);

    // Adherence: last 7d vs prior 3 weeks average (using scheduled expectation)
    const perWeekFromFreq = (f: string): number => {
      const s = (f || '').toLowerCase();
      if (s.includes('every day') || s.includes('daily')) return 7;
      if (s.includes('every other')) return 3.5;
      if (s.includes('5 days')) return 5;
      if (s.includes('twice')) return 2;
      if (s.includes('once') || s.includes('weekly')) return 1;
      return 7;
    };
    const expectedWeek = scheduledDoses.reduce((sum, s) => sum + perWeekFromFreq(s.frequency), 0);
    const adherenceThis = expectedWeek > 0 ? Math.min(100, Math.round((dosesThisWeek.length / expectedWeek) * 100)) : null;
    const prior3 = doses.filter(d => inWindow(new Date(d.dosed_at).getTime(), 28, 7)).length / 3;
    const adherencePrior = expectedWeek > 0 ? Math.min(100, Math.round((prior3 / expectedWeek) * 100)) : null;

    const fmtSite = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return {
      dosesThisWeek: dosesThisWeek.length,
      dosesLastWeek: dosesLastWeek.length,
      doseDelta: dosesThisWeek.length - dosesLastWeek.length,
      topSite: topSite ? { name: fmtSite(topSite[0]), count: topSite[1], share: totalSited ? Math.round((topSite[1] / totalSited) * 100) : 0 } : null,
      adherenceThis, adherencePrior,
      hasData: doses.length > 0,
    };
  }, [doses, scheduledDoses]);

  const insights = useMemo(() => {
    const out: { tone: 'good' | 'warn' | 'info'; text: string }[] = [];
    const now = Date.now();

    // Lapsed logging
    if (doses.length > 0) {
      const last = Math.max(...doses.map(d => new Date(d.dosed_at).getTime()));
      const daysSince = Math.floor((now - last) / 86400000);
      if (daysSince >= 3) out.push({ tone: 'warn', text: `No Doses Logged In ${daysSince} Days. Your Streak And Adherence Are Slipping.` });
    }

    // Streak callout
    if (doseStats.streak >= 3) out.push({ tone: 'good', text: `You Are On A ${doseStats.streak}-Day Logging Streak. Consistency Looks Strong.` });

    // Adherence trend
    if (weekReview.adherenceThis != null && weekReview.adherencePrior != null) {
      const diff = weekReview.adherenceThis - weekReview.adherencePrior;
      if (diff >= 10) out.push({ tone: 'good', text: `Adherence Up ${diff} Points Versus Your Prior 3-Week Average.` });
      else if (diff <= -10) out.push({ tone: 'warn', text: `Adherence Down ${Math.abs(diff)} Points Versus Your Prior 3-Week Average.` });
    }

    // Injection site overuse
    if (weekReview.topSite && weekReview.topSite.share >= 50 && weekReview.topSite.count >= 3) {
      out.push({ tone: 'warn', text: `${weekReview.topSite.name} Accounted For ${weekReview.topSite.share}% Of This Week's Injections. Rotate Sites To Rest The Tissue.` });
    }

    // Biggest biometric mover (7d) - computed inline from biometrics
    const metricNames = Array.from(new Set(biometrics.map(b => b.metric_name)));
    let biggest: { name: string; delta: number; unit: string } | null = null;
    metricNames.forEach(m => {
      const rows = biometrics.filter(b => b.metric_name === m)
        .map(b => ({ v: Number(b.metric_value), t: new Date(b.measured_at).getTime(), unit: b.unit }))
        .sort((a, b) => a.t - b.t);
      if (rows.length < 2) return;
      const current = rows[rows.length - 1].v;
      const cutoff = now - 7 * 86400000;
      const before = rows.filter(r => r.t <= cutoff);
      const past = before.length ? before[before.length - 1].v : rows[0].v;
      const delta = current - past;
      if (Math.abs(delta) > (biggest ? Math.abs(biggest.delta) : 0)) {
        biggest = { name: m, delta, unit: rows[rows.length - 1].unit || '' };
      }
    });
    if (biggest) {
      const b = biggest as { name: string; delta: number; unit: string };
      if (Math.abs(b.delta) > 0) {
        out.push({ tone: 'info', text: `Biggest 7-Day Metric Move: ${b.name} ${b.delta > 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(b.delta * 100) / 100)} ${b.unit}.` });
      }
    }

    // Compounds tracked
    if (doseStats.activeCompounds >= 2) {
      out.push({ tone: 'info', text: `You Are Actively Tracking ${doseStats.activeCompounds} Compounds Across Your Protocol.` });
    }

    return out;
  }, [doses, doseStats, weekReview, biometrics]);

  useEffect(() => {
    const syncLegacyData = async () => {
      try {
        const savedInv = localStorage.getItem('pnl_inventory_data');
        if (savedInv) {
          const invData = JSON.parse(savedInv);
          for (const [productId, data] of Object.entries<any>(invData)) {
            await fetch('/api/researcher/inventory', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ product_id: productId, on_hand: data.on_hand, lot_number: data.lot, expiration_date: data.expiration })
            });
          }
          localStorage.removeItem('pnl_inventory_data');
        }

        const savedSched = localStorage.getItem('pnl_scheduled_doses');
        if (savedSched) {
          const schedData = JSON.parse(savedSched);
          for (const s of schedData) {
            await fetch('/api/researcher/protocols', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ compound_slug: s.compound, amount: s.amount, unit: s.unit, frequency: s.frequency })
            });
          }
          localStorage.removeItem('pnl_scheduled_doses');
        }
      } catch (e) {
        console.error('Legacy sync failed', e);
      }
    };
    syncLegacyData();
  }, []);

  // Initialize notification permission from browser on mount + schedule daily dose reminders
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission('unsupported');
    }
  }, []);

  // Auto-fire reminders once per page load if permission already granted and doses are due
  useEffect(() => {
    if (notifPermission !== 'granted' || scheduledDoses.length === 0) return;
    const due = scheduledDoses.filter(s => scheduleDueStatus(s).status === 'due');
    if (due.length === 0) return;
    // Small delay to not immediately fire on page load — gives the user a moment first
    const t = setTimeout(() => {
      due.forEach(s => sendDoseReminder(s.compound_slug || s.compound));
    }, 8000);
    notifTimerRef.current = t;
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPermission, scheduledDoses]);

  const updateInventory = async (productId: string, field: string, value: any) => {
    // Optimistic write with rollback: recon_mg/recon_ml/recon_dose feed the
    // per-vial dose display, so silently keeping unsaved values on screen is
    // a dosing-data integrity problem, not just a UX one.
    const previous = inventoryData;
    const updated = { ...inventoryData };
    if (!updated[productId]) updated[productId] = { on_hand: 1, lot: '', expiration: '' };
    updated[productId] = { ...updated[productId], [field]: value };
    setInventoryData(updated);

    try {
      const res = await fetch('/api/researcher/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_id: productId, 
          on_hand: updated[productId].on_hand,
          lot_number: updated[productId].lot, 
          expiration_date: updated[productId].expiration,
          recon_mg: updated[productId].recon_mg,
          recon_ml: updated[productId].recon_ml,
          recon_dose: updated[productId].recon_dose
        })
      });
      if (!res.ok) {
        setInventoryData(previous);
        toast.error('Could Not Save Inventory Changes. Please Try Again.');
        reportClientError('lab-journal.update-inventory', new Error(`HTTP ${res.status}`));
      }
    } catch (e) {
      setInventoryData(previous);
      toast.error('Could Not Save Inventory Changes. Please Try Again.');
      reportClientError('lab-journal.update-inventory', e);
    }
  };

  const addScheduledDose = async () => {
    if (!scheduleCompound || !scheduleAmount) return;
    
    const payload = { compound_slug: scheduleCompound, amount: scheduleAmount, unit: scheduleUnit, frequency: scheduleFrequency };
    try {
      const res = await fetch('/api/researcher/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.protocol) {
        setScheduledDoses(prev => [data.protocol, ...prev]);
        setScheduleCompound(''); setScheduleAmount('');
      } else {
        toast.error('Could Not Save Scheduled Dose. Please Try Again.');
      }
    } catch (e) {
      toast.error('Could Not Save Scheduled Dose. Please Try Again.');
      reportClientError('lab-journal.add-scheduled-dose', e);
    }
  };

  const deleteScheduledDose = async (id: string) => {
    try {
      await fetch('/api/researcher/protocols', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      }).then(res => {
        if (res.ok) setScheduledDoses(prev => prev.filter(s => s.id !== id));
        else toast.error('Could Not Delete Scheduled Dose. Please Try Again.');
      });
    } catch (e) {
      toast.error('Could Not Delete Scheduled Dose. Please Try Again.');
      reportClientError('lab-journal.delete-scheduled-dose', e);
    }
  };

  // Compute whether a scheduled protocol is due today, based on its frequency and the
  // last logged dose for that compound. Defensive/null-safe; informational only.
  const scheduleDueStatus = (s: any): { status: 'due' | 'logged' | 'upcoming'; label: string } => {
    try {
      const compound = s.compound_slug || s.compound;
      const times = doses
        .filter(d => d.compound_slug === compound && d.dosed_at)
        .map(d => new Date(d.dosed_at).getTime())
        .filter(t => Number.isFinite(t))
        .sort((a, b) => b - a);
      const todayKey = dayKey(new Date());
      const loggedToday = times.some(t => dayKey(t) === todayKey);
      const lastDays = times.length ? Math.floor((Date.now() - times[0]) / 86400000) : null;
      const f = (s.frequency || '').toLowerCase();
      let interval = 1;
      if (f.includes('every other')) interval = 2;
      else if (f.includes('twice')) interval = 3;
      else if (f.includes('once') || f.includes('weekly')) interval = 7;
      else interval = 1; // every day / 5-on-2-off approximated as daily
      if (loggedToday) return { status: 'logged', label: 'Logged Today' };
      if (lastDays === null || lastDays >= interval) return { status: 'due', label: 'Due Today' };
      return { status: 'upcoming', label: `Next In ${Math.max(1, interval - lastDays)}d` };
    } catch {
      return { status: 'upcoming', label: '' };
    }
  };


  // Fetch researcher lab-journal data
  useEffect(() => {
    fetch('/api/researcher/notes')
      .then(res => res.json())
      .then(data => { if (data.notes) setNotes(data.notes); })
      .catch(console.error);

    fetch('/api/researcher/comparisons')
      .then(res => res.json())
      .then(data => { if (data.comparisons) setComparisons(data.comparisons); })
      .catch(console.error);

    fetch('/api/researcher/doses')
      .then(res => res.json())
      .then(data => { if (data.doses) setDoses(data.doses); })
      .catch(console.error);

    fetch('/api/researcher/biometrics')
      .then(res => res.json())
      .then(data => { if (data.biometrics) setBiometrics(data.biometrics); })
      .catch(console.error);

    fetch('/api/researcher/inventory')
      .then(res => res.json())
      .then(data => { 
        if (data.inventory) {
          const invMap: Record<string, any> = {};
          data.inventory.forEach((i: any) => invMap[i.product_id] = i);
          setInventoryData(invMap);
        }
      })
      .catch(console.error);

    fetch('/api/researcher/protocols')
      .then(res => res.json())
      .then(data => { if (data.protocols) setScheduledDoses(data.protocols); })
      .catch(console.error);

    fetch('/api/researcher/goals')
      .then(res => res.json())
      .then(data => { if (data.goals) setGoals(data.goals); })
      .catch(console.error);

    fetch('/api/researcher/progress-photos')
      .then(res => res.json())
      .then(data => { if (data.photos) setProgressPhotos(data.photos); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!intelligenceCompound) {
      setIntelligenceData(null);
      return;
    }
    setIntelligenceData({ loading: true });
    fetch(`/api/researcher/intelligence?slug=${encodeURIComponent(intelligenceCompound)}`)
      .then(res => res.json())
      .then(data => {
        if (data.intelligence) setIntelligenceData(data.intelligence);
        else setIntelligenceData(null);
      })
      .catch(() => setIntelligenceData(null));
  }, [intelligenceCompound]);

  const saveGoal = async () => {
    if (!goalName) return;
    setGoalSaving(true);
    try {
      const res = await fetch('/api/researcher/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_name: goalName, is_active: goals.length === 0 })
      });
      const data = await res.json();
      if (res.ok && data.goal) {
        setGoals(prev => [data.goal, ...prev.map(g => goals.length === 0 ? g : { ...g, is_active: false })]);
        setGoalName('');
        toast.success('Goal saved');
        if (goals.length === 0) {
           fetch('/api/researcher/goals').then(r => r.json()).then(d => { if (d.goals) setGoals(d.goals) });
        }
      }
    } catch {
      toast.error('Failed to save goal');
    } finally {
      setGoalSaving(false);
    }
  };

  const activateGoal = async (id: string) => {
    try {
      const res = await fetch('/api/researcher/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: true })
      });
      if (res.ok) {
        setGoals(prev => prev.map(g => ({ ...g, is_active: g.id === id })));
        toast.success('Active Goal Updated');
      } else {
        toast.error('Could Not Update Goal. Please Try Again.');
      }
    } catch (e) {
      toast.error('Could Not Update Goal. Please Try Again.');
      reportClientError('lab-journal.activate-goal', e);
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      const res = await fetch('/api/researcher/goals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setGoals(prev => prev.filter(g => g.id !== id));
        toast.success('Goal Deleted');
      } else {
        toast.error('Could Not Delete Goal. Please Try Again.');
      }
    } catch (e) {
      toast.error('Could Not Delete Goal. Please Try Again.');
      reportClientError('lab-journal.delete-goal', e);
    }
  };

  const saveComparison = async (ids: string[]) => {
    try {
      const res = await fetch('/api/researcher/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: ids })
      });
      const data = await res.json();
      if (res.ok && data.comparison) {
        setComparisons(prev => [data.comparison, ...prev]);
      }
    } catch (e) {
      console.error('Failed to save comparison', e);
    }
  };

  const generateLabReport = () => {
    const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    // Injection site summary
    const siteCounts: Record<string, number> = {};
    doses.forEach(d => { if (d.injection_site) siteCounts[d.injection_site] = (siteCounts[d.injection_site] || 0) + 1; });
    const siteRows = Object.entries(siteCounts).sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `<tr><td>${esc(s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}</td><td style="text-align:right">${n}</td></tr>`).join('');

    // Recent doses
    const doseRows = doses.slice(0, 25).map(d =>
      `<tr><td>${esc(new Date(d.dosed_at).toLocaleDateString())}</td><td>${esc(d.compound_slug)}</td><td>${esc(d.dose_amount)} ${esc(d.unit)}</td><td>${esc(d.injection_site ? d.injection_site.replace(/_/g, ' ') : '')}</td></tr>`
    ).join('') || '<tr><td colspan="4" style="color:#888">No Doses Logged</td></tr>';

    // Biometric summary
    const bioRows = trackedMetrics.map(m => {
      const s = metricStats(m);
      if (!s) return '';
      const arrow = (d: number) => d === 0 ? '' : d > 0 ? ' (Up ' + Math.abs(Math.round(d * 100) / 100) + ')' : ' (Down ' + Math.abs(Math.round(d * 100) / 100) + ')';
      return `<tr><td>${esc(m)}</td><td style="text-align:right">${esc(s.current)} ${esc(s.unit)}</td><td style="text-align:right">${esc(Math.round(s.d7 * 100) / 100)}${arrow(s.d7)}</td><td style="text-align:right">${esc(Math.round(s.d30 * 100) / 100)}</td></tr>`;
    }).join('') || '<tr><td colspan="4" style="color:#888">No Biometrics Logged</td></tr>';

    const insightRows = insights.map(i => `<li>${esc(i.text)}</li>`).join('') || '<li style="color:#888">No Signals Yet</li>';

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lab Report - ${today}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #14232f; margin: 0; padding: 40px; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #0a7d78; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #0a7d78; border-bottom: 2px solid #cfeceb; padding-bottom: 6px; margin: 26px 0 10px; }
  .sub { color: #667; font-size: 12px; margin-bottom: 20px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; }
  .card { flex: 1 1 120px; border: 1px solid #e3e9ee; border-radius: 8px; padding: 12px 14px; }
  .card .l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #889; }
  .card .v { font-size: 22px; font-weight: 800; color: #14232f; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eef2f5; }
  th { color: #667; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  ul { margin: 6px 0; padding-left: 18px; font-size: 12px; }
  li { margin-bottom: 4px; }
  .foot { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e3e9ee; font-size: 10px; color: #99a; }
  @media print { body { padding: 16px; } .noprint { display: none; } }
</style></head><body>
  <button class="noprint" onclick="window.print()" style="float:right;background:#0a7d78;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-weight:600">Print / Save As PDF</button>
  <h1>Pep Nation Lab - Research Log Summary</h1>
  <div class="sub">Generated ${today} · For Qualified Research Documentation Only</div>

  <h2>Protocol Overview</h2>
  <div class="cards">
    <div class="card"><div class="l">Adherence 30D</div><div class="v">${doseStats.adherence != null ? doseStats.adherence + '%' : '--'}</div></div>
    <div class="card"><div class="l">Current Streak</div><div class="v">${doseStats.streak} Days</div></div>
    <div class="card"><div class="l">Active Compounds</div><div class="v">${doseStats.activeCompounds}</div></div>
    <div class="card"><div class="l">Total Doses</div><div class="v">${doseStats.total}</div></div>
  </div>

  <h2>Signals</h2>
  <ul>${insightRows}</ul>

  <h2>Biometrics</h2>
  <table><thead><tr><th>Metric</th><th style="text-align:right">Current</th><th style="text-align:right">7-Day Change</th><th style="text-align:right">30-Day Change</th></tr></thead><tbody>${bioRows}</tbody></table>

  <h2>Injection Site Rotation</h2>
  <table><thead><tr><th>Site</th><th style="text-align:right">Times Used</th></tr></thead><tbody>${siteRows || '<tr><td colspan="2" style="color:#888">No Sites Logged</td></tr>'}</tbody></table>

  <h2>Recent Dose Log</h2>
  <table><thead><tr><th>Date</th><th>Compound</th><th>Amount</th><th>Site</th></tr></thead><tbody>${doseRows}</tbody></table>

  <div class="foot">Research Use Only. This Document Summarizes Self-Reported Research Log Data And Does Not Constitute Medical Advice, Diagnosis, Or A Dosing Recommendation. Concentration Estimates Are Informational.</div>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { toast.error('Please Allow Pop-Ups To Generate The Report'); return; }
    w.document.write(html);
    w.document.close();
    toast.success('Lab Report Generated');
  };

  const exportJournalToCSV = () => {
    let csv = 'Type,Date,Title/Items,Details\n';
    
    // Add Notes
    notes.forEach(n => {
      csv += `Note,${new Date(n.updated_at).toLocaleDateString()},"${(n.title || 'Journal Entry').replace(/"/g, '""')}","${(n.note_text || '').replace(/"/g, '""')}"\n`;
    });
    
    // Add Comparisons
    comparisons.forEach(c => {
      csv += `Comparison,${new Date(c.created_at).toLocaleDateString()},"Folder: ${(c.folder_name || 'Unsorted').replace(/"/g, '""')} | Items: ${c.product_ids.join(', ')}","${(c.notes || '').replace(/"/g, '""')}"\n`;
    });

    // Add Doses
    doses.forEach(d => {
      csv += `Dose,${new Date(d.dosed_at).toLocaleString()},"${String(d.compound_slug || '').replace(/"/g, '""')}","${d.dose_amount} ${d.unit}${d.injection_site ? ` | Site: ${d.injection_site}` : ''}${d.notes ? ` | ${String(d.notes).replace(/"/g, '""')}` : ''}"\n`;
    });

    // Add Biometrics
    biometrics.forEach(b => {
      csv += `Biometric,${new Date(b.measured_at).toLocaleString()},"${String(b.metric_name || '').replace(/"/g, '""')}","${b.metric_value} ${b.unit || ''}"\n`;
    });

    // Add Inventory
    Object.entries(inventoryData).forEach(([pid, data]) => {
      const item = [...favorites, ...pastOrders, ...recentlyViewed, ...catalog].find(i => i.product_id === pid);
      if (item) {
        csv += `Inventory,${new Date().toLocaleDateString()},"${(item.name || '').replace(/"/g, '""')}","On Hand: ${data.on_hand} | Lot: ${data.lot} | Exp: ${data.expiration}"\n`;
      }
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lab_Journal_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Journal Exported To CSV');
  };

  async function removeItem(productId: string) {
    setPendingId(productId);
    try {
      const res = await fetch('/api/researcher/wishlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        startTransition(() => {
          setFavorites(prev => prev.filter(it => it.product_id !== productId));
          const nextSel = new Set(selectedItems);
          nextSel.delete(productId);
          setSelectedItems(nextSel);
        });
      }
    } finally {
      setPendingId(null);
    }
  }

  async function toggleFavorite(item: Item) {
    const isFav = favorites.some(f => f.product_id === item.product_id);
    setPendingId(item.product_id);
    try {
      if (isFav) {
        const res = await fetch('/api/researcher/wishlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ productId: item.product_id }),
        });
        if (res.ok) {
          startTransition(() => {
            setFavorites(prev => prev.filter(f => f.product_id !== item.product_id));
          });
          toast.success('Removed From Saved Compounds');
        }
      } else {
        const res = await fetch('/api/researcher/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ productId: item.product_id }),
        });
        if (res.ok) {
          startTransition(() => {
            setFavorites(prev => [item, ...prev]);
          });
          toast.success('Added To Saved Compounds');
        }
      }
    } catch (e) {
      toast.error('Error updating saved compounds');
    } finally {
      setPendingId(null);
    }
  }

  async function clearRecentlyViewed() {
    if (!confirm('Are You Sure You Want To Clear Your Recently Viewed History?')) return;
    try {
      const res = await fetch('/api/researcher/recently-viewed', { method: 'DELETE' });
      if (res.ok) {
        startTransition(() => {
          setRecentlyViewed([]);
        });
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  // Notes Functions
  const openNewNote = () => {
    setNoteTitle('');
    setNoteText('');
    setNoteCompoundSlug('');
    setEditingNote(null);
    setIsCreatingNote(true);
  };

  const editNote = (n: any) => {
    setNoteTitle(n.title || '');
    setNoteText(n.note_text || '');
    setNoteCompoundSlug(n.compound_slug || '');
    setEditingNote(n);
    setIsCreatingNote(true);
  };

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    try {
      const url = '/api/researcher/notes';
      const method = editingNote ? 'PATCH' : 'POST';
      const body = editingNote 
        ? { id: editingNote.id, title: noteTitle, note_text: noteText, compound_slug: noteCompoundSlug || null } 
        : { title: noteTitle, note_text: noteText, compound_slug: noteCompoundSlug || null };
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.note) {
        if (editingNote) setNotes(prev => prev.map(n => n.id === data.note.id ? data.note : n));
        else setNotes(prev => [data.note, ...prev]);
        setIsCreatingNote(false);
        toast.success(editingNote ? 'Note Updated' : 'Note Saved');
      } else throw new Error(data.error);
    } catch (e) {
      toast.error('Failed To Save Note');
    } finally {
      setNoteSaving(false);
    }
  };

  const generateAiProtocol = async () => {
    if (aiCompounds.length === 0 || !aiGoal.trim()) return;
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/researcher/ai-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compounds: aiCompounds, goal: aiGoal, experienceLevel: aiExperience, subjectMetrics: aiMetrics })
      });
      const data = await res.json();
      if (res.ok && data.note) {
        setNotes(prev => [data.note, ...prev]);
        setShowAiBuilder(false);
        setAiGoal('');
        setAiCompounds([]);
        toast.success('AI Protocol Generated And Saved To Notes!');
      } else throw new Error(data.error);
    } catch (e) {
      toast.error('Failed To Generate Protocol');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Delete This Note?')) return;
    try {
      const res = await fetch('/api/researcher/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== id));
        toast.success('Note Deleted');
      }
    } catch (e) {
      toast.error('Failed To Delete Note');
    }
  };

  const deleteComparison = async (id: string) => {
    if (!confirm('Delete This Saved Comparison?')) return;
    try {
      const res = await fetch('/api/researcher/comparisons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setComparisons(c => c.filter(x => x.id !== id));
        toast.success('Comparison Deleted');
      } else {
        toast.error('Failed To Delete Comparison');
      }
    } catch {
      toast.error('Error Deleting Comparison');
    }
  };

  const saveDose = async () => {
    if (!doseCompound || !doseAmount) return;
    setDoseSaving(true);
    try {
      const payload = {
        compound_slug: doseCompound,
        dose_amount: parseFloat(doseAmount),
        unit: doseUnit,
        dosed_at: new Date().toISOString(),
        injection_site: selectedSite,
        notes: doseNote || null,
      };

      const res = await fetch('/api/researcher/doses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.dose) {
        setDoses(prev => [data.dose, ...prev]);
        setDoseAmount('');
        setSelectedSite('');
        setDoseNote('');
        toast.success('Dose Logged');
      } else throw new Error(data.error || 'Failed to log dose');
    } catch (e) {
      toast.error('Failed To Log Dose');
    } finally {
      setDoseSaving(false);
    }
  };

  const repeatLastDose = async (last: any) => {
    if (!last) return;
    setDoseSaving(true);
    try {
      const res = await fetch('/api/researcher/doses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compound_slug: last.compound_slug,
          dose_amount: Number(last.dose_amount),
          unit: last.unit,
          dosed_at: new Date().toISOString(),
          injection_site: last.injection_site || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.dose) {
        setDoses(prev => [data.dose, ...prev]);
        toast.success(`Repeated ${last.compound_slug}`);
      } else throw new Error();
    } catch {
      toast.error('Failed To Repeat Dose');
    } finally {
      setDoseSaving(false);
    }
  };

  const deleteDose = async (id: string) => {
    if (!confirm('Delete This Dose Log?')) return;
    try {
      const res = await fetch('/api/researcher/doses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setDoses(prev => prev.filter(d => d.id !== id));
        toast.success('Dose Deleted');
      } else {
        toast.error('Failed To Delete Dose');
      }
    } catch {
      toast.error('Error Deleting Dose');
    }
  };

  const loadBiometrics = async () => {
    try {
      const res = await fetch('/api/researcher/biometrics');
      const data = await res.json();
      if (data.biometrics) setBiometrics(data.biometrics);
    } catch (e) {
      console.error(e);
    }
  };

  const saveBiometric = async () => {
    if (!bioName || !bioValue) return;
    setBioSaving(true);
    try {
      const res = await fetch('/api/researcher/biometrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric_name: bioName, metric_value: parseFloat(bioValue), unit: bioUnit })
      });
      if (res.ok) {
        toast.success('Logged successfully');
        setBioValue('');
        await loadBiometrics();
      } else {
        toast.error('Failed to log');
      }
    } catch {
      toast.error('Error logging');
    } finally {
      setBioSaving(false);
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      try {
        const rows = text.split('\n').filter(r => r.trim());
        if (rows.length < 2) return toast.error('Invalid CSV format');
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        
        const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('time'));
        const metricIdx = headers.findIndex(h => h.includes('metric') || h.includes('name'));
        const valueIdx = headers.findIndex(h => h.includes('value') || h.includes('amount'));
        const unitIdx = headers.findIndex(h => h.includes('unit'));

        if (metricIdx === -1 || valueIdx === -1) {
          return toast.error('CSV must have Metric/Name and Value columns');
        }

        const toImport = rows.slice(1).map(r => {
          const cols = r.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (!cols[metricIdx] || !cols[valueIdx]) return null;
          return {
            measured_at: dateIdx !== -1 && cols[dateIdx] ? new Date(cols[dateIdx]).toISOString() : new Date().toISOString(),
            metric_name: cols[metricIdx],
            metric_value: parseFloat(cols[valueIdx]),
            unit: unitIdx !== -1 ? cols[unitIdx] : ''
          };
        }).filter(Boolean);

        if (toImport.length === 0) return toast.error('No valid records found in CSV');

        toast.loading(`Importing ${toImport.length} records...`, { id: 'csv-import' });
        
        // Chunk into 100s
        let success = 0;
        for (let i = 0; i < toImport.length; i += 100) {
          const chunk = toImport.slice(i, i + 100);
          const res = await fetch('/api/researcher/biometrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk)
          });
          if (res.ok) {
            success += chunk.length;
          } else {
            console.error(await res.text());
          }
        }
        
        if (success > 0) {
          toast.success(`Imported ${success} records`, { id: 'csv-import' });
        await loadBiometrics();
        } else {
          toast.error('Failed to import records', { id: 'csv-import' });
        }
      } catch (err) {
        toast.error('Import failed', { id: 'csv-import' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  };

  const deleteBiometric = async (id: string) => {
    if (!confirm('Delete This Biometric Log?')) return;
    try {
      const res = await fetch('/api/researcher/biometrics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setBiometrics(prev => prev.filter(b => b.id !== id));
        toast.success('Biometric Deleted');
      } else {
        toast.error('Failed To Delete Biometric');
      }
    } catch {
      toast.error('Error Deleting Biometric');
    }
  };

  // Per-metric analytics: current value, deltas, sparkline series
  const metricStats = (name: string) => {
    const rows = biometrics
      .filter(b => b.metric_name === name)
      .map(b => ({ v: Number(b.metric_value), t: new Date(b.measured_at).getTime() }))
      .sort((a, b) => a.t - b.t);
    if (rows.length === 0) return null;
    const now = Date.now();
    const current = rows[rows.length - 1].v;
    const valAt = (daysAgo: number) => {
      const cutoff = now - daysAgo * 86400000;
      const before = rows.filter(r => r.t <= cutoff);
      return before.length ? before[before.length - 1].v : rows[0].v;
    };
    const d7 = current - valAt(7);
    const d30 = current - valAt(30);
    const preset = BIOMETRIC_PRESETS.find(p => p.name === name);
    const spark = rows.slice(-12).map((r, i) => ({ i, v: r.v }));
    return { current, d7, d30, unit: biometrics.filter(b => b.metric_name === name).slice(-1)[0]?.unit || preset?.unit || '', better: preset?.better || 'none', spark, count: rows.length };
  };

  const trackedMetrics = useMemo(
    () => Array.from(new Set(biometrics.map(b => b.metric_name))),
    [biometrics]
  );

  // Dose-day vs non-dose-day associational comparison (Bearable-style "Impacts")
  const doseImpacts = useMemo(() => {
    const doseDaySet = new Set(doses.map(d => dayKey(d.dosed_at)));
    if (doseDaySet.size === 0) return [];
    const round1 = (n: number) => Math.round(n * 100) / 100;
    const results: { metric: string; unit: string; onAvg: number; offAvg: number; onN: number; offN: number; delta: number }[] = [];
    trackedMetrics.forEach(metric => {
      const rows = biometrics.filter(b => b.metric_name === metric);
      const on: number[] = [], off: number[] = [];
      let unit = '';
      rows.forEach(b => {
        unit = b.unit || unit;
        (doseDaySet.has(dayKey(b.measured_at)) ? on : off).push(Number(b.metric_value));
      });
      // Need a meaningful sample in both buckets
      if (on.length < 2 || off.length < 2) return;
      const onAvg = round1(on.reduce((a, c) => a + c, 0) / on.length);
      const offAvg = round1(off.reduce((a, c) => a + c, 0) / off.length);
      results.push({ metric, unit, onAvg, offAvg, onN: on.length, offN: off.length, delta: round1(onAvg - offAvg) });
    });
    // Rank by magnitude of difference
    return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [doses, biometrics, trackedMetrics]);

  // Trend chart: raw dots + moving-average line + optional goal + dose-day markers
  const renderBioTrendChart = (metric: string) => {
    const cutoff = Date.now() - bioRange * 86400000;
    const rows = biometrics
      .filter(b => b.metric_name === metric && new Date(b.measured_at).getTime() >= cutoff)
      .map(b => ({ t: new Date(b.measured_at).getTime(), v: Number(b.metric_value), label: dayKey(b.measured_at) }))
      .sort((a, b) => a.t - b.t);
    if (rows.length === 0) return (
      <div key={metric} style={{ color: 'var(--silver)', padding: 'var(--space-4)', fontSize: '0.9rem' }}>No {metric} Data In This Range.</div>
    );

    // Exponentially weighted trend line
    const alpha = 0.35;
    let ema = rows[0].v;
    const data = rows.map((r, i) => {
      ema = i === 0 ? r.v : alpha * r.v + (1 - alpha) * ema;
      return { ...r, raw: r.v, trend: Math.round(ema * 100) / 100 };
    });
    const goal = biometricGoals[metric];
    // Dose days within range for overlay markers
    const doseDays = Array.from(new Set(
      doses.filter(d => new Date(d.dosed_at).getTime() >= cutoff).map(d => dayKey(d.dosed_at))
    ));
    const yVals = data.map(d => d.raw);
    const yMin = Math.min(...yVals), yMax = Math.max(...yVals);

    return (
      <div key={metric} className="glass-panel" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ color: 'var(--white)', margin: 0, fontSize: '1.05rem' }}>{metric} Trend</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>Target</span>
            <input
              type="number"
              placeholder="Goal"
              value={goal ?? ''}
              onChange={e => setGoal(metric, parseFloat(e.target.value))}
              style={{ width: 84, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 6, color: 'var(--white)', fontSize: '0.85rem' }}
            />
          </div>
        </div>
        <div style={{ width: '100%', height: 300 }}>
          <BiometricTrendChart data={data} metric={metric} goal={goal} doseDays={doseDays} yMin={yMin} yMax={yMax} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.75rem', color: 'var(--silver)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 3, background: '#00E5FF', verticalAlign: 'middle', marginRight: 4 }} />Weighted Trend</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'rgba(208,218,228,0.55)', verticalAlign: 'middle', marginRight: 4 }} />Raw Reading</span>
          <span><span style={{ display: 'inline-block', width: 2, height: 10, background: 'rgba(246,173,85,0.6)', verticalAlign: 'middle', marginRight: 4 }} />Dose Day</span>
        </div>
      </div>
    );
  };

  const rangeSwitcher = (value: number, onChange: (v: any) => void) => (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', borderRadius: 999, padding: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
      {[7, 30, 90, 365].map(r => (
        <button key={r} onClick={() => onChange(r)} style={{ background: value === r ? 'var(--teal)' : 'transparent', color: value === r ? 'var(--black)' : 'var(--silver)', border: 'none', borderRadius: 999, padding: '4px 12px', fontSize: '0.8rem', fontWeight: value === r ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {r === 365 ? 'All' : `${r}D`}
        </button>
      ))}
    </div>
  );

  const statCard = (label: string, value: React.ReactNode, sub?: React.ReactNode, icon?: any, accent = 'var(--teal)') => {
    const Icon = icon;
    return (
      <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: accent, opacity: 0.06 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--silver)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {Icon && <Icon size={14} style={{ color: accent }} />} {label}
        </div>
        <div style={{ color: 'var(--white)', fontSize: '1.7rem', fontWeight: 800, fontFamily: 'var(--font-brand)', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ color: 'var(--silver)', fontSize: '0.78rem' }}>{sub}</div>}
      </div>
    );
  };

  // Downscale an image file client-side to keep uploads small, return a JPEG data URL.
  const resizeImage = (file: File, maxDim = 1400, quality = 0.82): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const img = new window.Image();
        img.onerror = () => reject(new Error('decode failed'));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
            else { width = Math.round(width * (maxDim / height)); height = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('no canvas'));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const uploadProgressPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please Choose An Image File'); return; }
    setPhotoUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      const res = await fetch('/api/researcher/progress-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: dataUrl, caption: photoCaption || null, taken_at: photoDate }),
      });
      const data = await res.json();
      if (res.ok && data.photo) {
        setProgressPhotos(prev => [data.photo, ...prev].sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()));
        setPhotoCaption('');
        toast.success('Progress Photo Added');
      } else throw new Error(data.error || 'Upload failed');
    } catch (e) {
      toast.error('Failed To Add Photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const deleteProgressPhoto = async (id: string) => {
    if (!confirm('Delete This Progress Photo?')) return;
    try {
      const res = await fetch('/api/researcher/progress-photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setProgressPhotos(prev => prev.filter(p => p.id !== id));
        toast.success('Photo Deleted');
      } else toast.error('Failed To Delete Photo');
    } catch {
      toast.error('Error Deleting Photo');
    }
  };

  const renderCombinedChart = (metric: string) => {
    // Group by day string
    const byDay: Record<string, any> = {};
    let hasData = false;
    
    if (metric !== 'Doses Only') {
      const mData = biometrics.filter(b => b.metric_name === metric).sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
      mData.forEach(m => {
        const day = new Date(m.measured_at).toLocaleDateString();
        if (!byDay[day]) byDay[day] = { date: day };
        byDay[day][metric] = m.metric_value;
        hasData = true;
      });
    }
    
    // Also include doses in the same chart
    doses.forEach(d => {
      const day = new Date(d.dosed_at).toLocaleDateString();
      if (!byDay[day]) byDay[day] = { date: day };
      byDay[day][d.compound_slug] = (byDay[day][d.compound_slug] || 0) + d.dose_amount;
      hasData = true;
    });

    const chartData = Object.values(byDay).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!hasData || chartData.length === 0) return null;
    
    const compoundsPresent = Array.from(new Set(doses.map(d => d.compound_slug)));
    const colors = ['#00E5FF', '#F6AD55', '#68D391', '#D6BCFA', '#FC8181'];
    const goal = metric !== 'Doses Only' ? biometricGoals[metric] : undefined;

    return (
      <div key={metric} style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
           <h3 style={{ color: 'var(--white)', margin: 0 }}>Protocol Correlation: {metric}</h3>
           {metric !== 'Doses Only' && (
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <span style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>Target Goal:</span>
               <input 
                 type="number" 
                 placeholder="Set Goal"
                 value={goal || ''}
                 onChange={e => setGoal(metric, parseFloat(e.target.value))}
                 style={{ width: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4, color: 'var(--white)', fontSize: '0.9rem' }}
               />
             </div>
           )}
        </div>
        <div style={{ width: '100%', height: 350, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 'var(--space-4)', position: 'relative' }}>
          {goal && (
             <div style={{ position: 'absolute', top: 10, left: 20, zIndex: 10, color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                Active Target: {goal}
             </div>
          )}
          <BiometricDoseOverlayChart chartData={chartData} metric={metric} goal={goal} compoundsPresent={compoundsPresent} colors={colors} />
        </div>
      </div>
    );
  };

  const renderGanttChart = () => {
    if (pastOrders.length === 0) return null;
    
    // Sort orders by purchase date
    const orders = [...pastOrders].filter(o => o.last_purchased_date).sort((a, b) => new Date(a.last_purchased_date!).getTime() - new Date(b.last_purchased_date!).getTime());
    if (orders.length === 0) return null;

    const earliestDate = new Date(orders[0].last_purchased_date!).getTime();
    const latestOrderDate = new Date(orders[orders.length - 1].last_purchased_date!).getTime();
    // End date is 8 weeks after the latest order
    const latestDate = latestOrderDate + (8 * 7 * 24 * 60 * 60 * 1000);
    // totalDuration intentionally removed (unused; clampedTotalDuration is used instead)

    // We don't want to show years of history on a small chart, so clamp to the last 6 months if needed
    const minTime = Math.max(earliestDate, new Date().getTime() - (180 * 24 * 60 * 60 * 1000));
    const clampedTotalDuration = latestDate - minTime;

    return (
      <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Layers size={20} color="var(--teal)" />
          <h3 style={{ margin: 0, color: 'var(--white)' }}>Interactive Cycle Timeline (8-Week Lifecycle)</h3>
        </div>
        <div style={{ position: 'relative', padding: '10px 0', minHeight: 100 }}>
          {/* Today Line */}
          <div style={{ position: 'absolute', left: `${Math.max(0, ((new Date().getTime() - minTime) / clampedTotalDuration) * 100)}%`, top: 0, bottom: 0, width: 2, background: 'rgba(255,100,100,0.5)', zIndex: 0 }} />
          
          {orders.filter(o => new Date(o.last_purchased_date!).getTime() >= minTime).map((order, i) => {
             const start = new Date(order.last_purchased_date!).getTime();
             const end = start + (8 * 7 * 24 * 60 * 60 * 1000); // 8 weeks
             const leftPct = ((start - minTime) / clampedTotalDuration) * 100;
             const widthPct = ((end - start) / clampedTotalDuration) * 100;
             
             const isActive = start <= new Date().getTime() && end >= new Date().getTime();

             return (
               <div key={order.product_id + i} style={{ marginBottom: 12, position: 'relative', height: 28 }}>
                 <div style={{ 
                   position: 'absolute', 
                   left: `${Math.max(0, leftPct)}%`, 
                   width: `${Math.min(100 - leftPct, widthPct)}%`, 
                   height: '100%', 
                   background: isActive ? 'linear-gradient(90deg, rgba(0, 229, 255, 0.2), rgba(0, 229, 255, 0.8))' : 'rgba(255,255,255,0.1)',
                   borderRadius: 4,
                   display: 'flex',
                   alignItems: 'center',
                   padding: '0 8px',
                   border: isActive ? '1px solid var(--teal)' : '1px solid rgba(255,255,255,0.05)',
                   whiteSpace: 'nowrap',
                   overflow: 'hidden',
                   textOverflow: 'ellipsis',
                   fontSize: '0.75rem',
                   color: isActive ? 'var(--white)' : 'var(--silver)',
                   zIndex: 1
                 }} title={`${order.name}\nPurchased: ${new Date(start).toLocaleDateString()}\nEst. End: ${new Date(end).toLocaleDateString()}`}>
                    {order.name}
                 </div>
               </div>
             );
          })}
          {/* Axis Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 16 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--silver)' }}>{new Date(minTime).toLocaleDateString()}</span>
            <span style={{ fontSize: '0.75rem', color: '#FF6464' }}>Today</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--silver)' }}>{new Date(latestDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  };

  function handleQuickAdd(item: Item, qty = 1, silent = false) {
    try {
      const storageKey = storefrontSlug ? `pnl_storefront_cart_${storefrontSlug}` : 'pnl_storefront_cart';
      const rawCart = localStorage.getItem(storageKey);
      let pnlCart = { items: [] as any[], _savedAt: Date.now() };
      if (rawCart) {
        try { pnlCart = JSON.parse(rawCart); } catch {}
      }

      const existing = pnlCart.items.find((i: any) => i.id === item.product_id);
      if (existing) {
        existing.quantity += qty;
      } else {
        // Agent self-buy: use base_cost (cost price) so the cart reflects the
        // wholesale price, not the storefront retail price shown to researchers.
        const perVial = isAgentSelfBuy
          ? (item.base_cost ?? item.retail_price ?? 0)
          : (item.retail_price ?? item.base_cost ?? 0);
        pnlCart.items.push({
          id: item.product_id,
          name: `${item.name} ${item.unit_size ? `(${item.unit_size}${item.unit_measure || ''})` : ''}`.trim(),
          sku: item.product_id,
          quantity: qty,
          retailPrice: perVial,
          costPrice: perVial,
          weightOz: 0.5,
          agentSelfBuy: isAgentSelfBuy,
        });
      }

      pnlCart._savedAt = Date.now();
      localStorage.setItem(storageKey, JSON.stringify(pnlCart));

      if (item.agent_product_id) {
        const gridKey = `cart_${storefrontSlug}`;
        const rawGrid = localStorage.getItem(gridKey);
        let gridMap: Record<string, number> = {};
        if (rawGrid) {
          try { gridMap = JSON.parse(rawGrid) || {}; } catch {}
        }
        gridMap[item.agent_product_id] = (gridMap[item.agent_product_id] || 0) + qty;
        localStorage.setItem(gridKey, JSON.stringify(gridMap));
      }

      window.dispatchEvent(new Event('storage'));
      
      const nextIds = new Set(localCartIds);
      nextIds.add(item.product_id);
      setLocalCartIds(nextIds);
      
      if (!silent) {
        toast.success(`Added ${item.name} to Cart`);
      }
    } catch (err) {
      console.error('Failed to quick add:', err);
    }
  }

  function handleBulkAdd() {
    if (selectedItems.size === 0) return;
    const baseItems = activeTab === 'favorites' ? favorites : activeTab === 'inventory' ? pastOrders : activeTab === 'bundles' ? bundles : recentlyViewed;
    const toAdd = baseItems.filter(i => selectedItems.has(i.product_id) && i.in_stock !== false);
    if (toAdd.length === 0) return;
    
    toAdd.forEach(i => handleQuickAdd(i, 1, true));
    setSelectedItems(new Set());
    toast.success(`Added ${toAdd.length} Items To Cart`);
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  }

  // Derived Data
  let currentItems = activeTab === 'favorites' ? favorites : activeTab === 'inventory' ? pastOrders : activeTab === 'bundles' ? bundles : activeTab === 'recentlyViewed' ? recentlyViewed : [];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    currentItems = currentItems.filter(i => i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
  }
  if (filterCategory !== 'all') {
    currentItems = currentItems.filter(i => i.category === filterCategory);
  }

  currentItems = [...currentItems].sort((a, b) => {
    if (sortBy === 'priceAsc') return (a.retail_price || 0) - (b.retail_price || 0);
    if (sortBy === 'priceDesc') return (b.retail_price || 0) - (a.retail_price || 0);
    if (sortBy === 'alpha') return a.name.localeCompare(b.name);
    if (sortBy === 'frequent' && activeTab === 'inventory') return (b.purchase_count || 0) - (a.purchase_count || 0);
    return 0; // recent/default
  });

  const visibleItems = currentItems.slice(0, visibleCount);

  const shouldGroup = viewMode === 'grid' && filterCategory === 'all' && sortBy === 'recent' && !searchQuery;

  const groupedItems = shouldGroup ? visibleItems.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, Item[]>) : { 'All': visibleItems };

  const renderEmptyState = () => (
    <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {activeTab === 'favorites' ? (
        <Heart size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      ) : activeTab === 'inventory' ? (
        <PackageOpen size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      ) : activeTab === 'bundles' ? (
        <Layers size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      ) : (
        <History size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      )}
      <h2 style={{ color: 'var(--white)', fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>
        {activeTab === 'favorites' ? 'Your Wishlist Is Empty' : activeTab === 'inventory' ? 'No Inventory Found' : activeTab === 'bundles' ? 'No Bundles Found' : 'Nothing Here Yet'}
      </h2>
      <p style={{ color: 'var(--silver)', fontSize: '0.95rem', maxWidth: 400 }}>
        {activeTab === 'favorites' ? 'Tap the heart icon on any product to save it here for later.' : 
         activeTab === 'inventory' ? 'Items you purchase will appear here. Manage your stock and usage.' : 
         activeTab === 'bundles' ? 'Bundles and stacks curated for optimal results will appear here.' :
         activeTab === 'compareHistory' ? 'Compounds you have compared will appear here.' :
         activeTab === 'notes' ? 'Your personal lab journal notes will appear here.' :
         activeTab === 'goals' ? 'Create a research goal to focus your studies and receive intelligent recommendations.' :
         'Browse products on a storefront and they will magically appear here.'}
      </p>
      {storefrontSlug && (
        <Link href={`/${storefrontSlug}`} className="btn btn-primary" style={{ marginTop: 'var(--space-6)', padding: '12px 24px' }}>
          Explore The Catalog
        </Link>
      )}
    </div>
  );

  const renderItemCard = (item: Item, index: number) => {
    const displayPrice = item.retail_price ?? item.base_cost ?? 0;
    const inCart = localCartIds.has(item.product_id);
    const isSelected = selectedItems.has(item.product_id);

    return (
      <div
        key={item.product_id}
        className="glass-panel hover-lift stagger-fade-in"
        style={{
          display: 'flex',
          flexDirection: viewMode === 'grid' ? 'column' : 'row',
          overflow: 'hidden',
          padding: 0,
          borderRadius: 'var(--radius-lg)',
          animationDelay: `${Math.min(index * 0.05, 0.5)}s`,
          border: isSelected ? '1px solid var(--teal)' : undefined,
          boxShadow: isSelected ? '0 0 0 1px var(--teal)' : undefined,
          transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          cursor: 'pointer',
        }}
        onClick={(e) => {
          // If clicking a button, ignore
          if ((e.target as HTMLElement).closest('button, a')) return;
          setQuickViewItem(item);
        }}
      >
        <div
          style={{
            height: viewMode === 'grid' ? 160 : 100,
            width: viewMode === 'list' ? 100 : 'auto',
            background: 'radial-gradient(circle at 50% 50%, rgba(192,184,168,0.10) 0%, var(--black) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', flexShrink: 0, overflow: 'hidden'
          }}
        >
          <Image
            src={item.image_url || getProductImage(null, item.category || 'Other', item.name)}
            alt={item.name}
            fill
            unoptimized
            style={{ objectFit: 'cover', transition: 'transform 0.4s' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const fallback = getProductImage(null, item.category || 'Other', item.name);
              if (target.src !== fallback) target.src = fallback;
            }}
          />
          
          {/* Checkbox Overlay */}
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }} onClick={e => { e.stopPropagation(); toggleSelection(item.product_id); }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.4)', background: isSelected ? 'var(--teal)' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isSelected && <Check size={14} color="var(--black)" />}
            </div>
          </div>

          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', zIndex: 2 }}>
            {inCart && (
              <Image src="/images/badges/badge_in_cart.png" alt="In Cart" width={22} height={22} unoptimized style={{ borderRadius: 9999, overflow: 'hidden', objectFit: 'contain' }} />
            )}
            {item.is_on_sale && (
              <Image src="/images/badges/badge_price_drop.png" alt="Price Drop" width={22} height={22} unoptimized style={{ borderRadius: 9999, overflow: 'hidden', objectFit: 'contain' }} />
            )}
            {activeTab === 'inventory' && item.purchase_count && item.purchase_count > 1 && sortBy === 'frequent' && (
              <div style={{ background: 'rgba(0,196,188,0.20)', border: '1px solid rgba(0,196,188,0.50)', color: '#00C4BC', padding: '2px 8px', borderRadius: 12, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', backdropFilter: 'blur(4px)' }}>
                Ordered {item.purchase_count}x
              </div>
            )}
          </div>
          
          {item.in_stock === false && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'grayscale(100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
              <Image src="/images/badges/badge_out_of_stock.png" alt="Out of Stock" width={80} height={26} unoptimized style={{ borderRadius: 9999, overflow: 'hidden', objectFit: 'contain' }} />
            </div>
          )}

          {/* Heart Icon Overlay */}
          <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 10 }}>
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item); }} disabled={pendingId === item.product_id} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: pendingId === item.product_id ? 0.5 : 1 }}>
              <Heart size={16} color={favorites.some(f => f.product_id === item.product_id) ? 'var(--red)' : 'var(--silver)'} fill={favorites.some(f => f.product_id === item.product_id) ? 'var(--red)' : 'none'} />
            </button>
          </div>
        </div>

        <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, whiteSpace: viewMode === 'list' ? 'nowrap' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </div>
          <div style={{ color: 'var(--silver)', fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2 }}>
            {item.category || 'Compound'} {item.unit_size && `• ${item.unit_size}${item.unit_measure}`}
          </div>
          
          {activeTab === 'inventory' && (
            <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--silver)' }}>On Hand:</span>
                <input type="number" value={inventoryData[item.product_id]?.on_hand ?? 0} onChange={e => updateInventory(item.product_id, 'on_hand', parseInt(e.target.value) || 0)} style={{ width: 60, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '2px 6px', borderRadius: 4, textAlign: 'right' }} onClick={e => e.stopPropagation()} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--silver)' }}>Lot #:</span>
                <input type="text" placeholder="e.g. 1A2B" value={inventoryData[item.product_id]?.lot ?? ''} onChange={e => updateInventory(item.product_id, 'lot', e.target.value)} style={{ width: 90, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '2px 6px', borderRadius: 4, textAlign: 'right' }} onClick={e => e.stopPropagation()} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--silver)' }}>Expires:</span>
                <input type="month" value={inventoryData[item.product_id]?.expiration ?? ''} onChange={e => updateInventory(item.product_id, 'expiration', e.target.value)} style={{ width: 110, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '2px 6px', borderRadius: 4, textAlign: 'right' }} onClick={e => e.stopPropagation()} />
              </div>
              {inventoryData[item.product_id]?.recon_mg && inventoryData[item.product_id]?.recon_ml && (
                <div style={{ marginTop: 4 }}>
                  <button
                    onClick={e => { e.stopPropagation(); setQrModalProduct(item.product_id); }}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    Vial Label (QR)
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: viewMode === 'grid' ? 'auto' : 4, paddingTop: viewMode === 'grid' ? 'var(--space-3)' : 0 }}>
            {displayPrice > 0 ? (
              <div style={{ color: 'var(--teal)', fontWeight: 800, fontSize: '1.05rem', fontFamily: 'var(--font-brand)' }}>
                ${displayPrice.toFixed(2)}
              </div>
            ) : <div/>}
            {viewMode === 'list' && (
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {storefrontSlug && (
                  <>
                    <Link href={`/${storefrontSlug}?product=${encodeURIComponent(item.product_id)}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 12px' }}>View</Link>
                    <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(item); }} disabled={item.in_stock === false} className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }}>Add</button>
                  </>
                )}
                {activeTab === 'favorites' && (
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.product_id); }} disabled={pendingId === item.product_id} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--red)' }}><Trash2 size={14}/></button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 'var(--space-6)', paddingBottom: '100px', alignItems: 'flex-start' }}>
      {/* Left Sidebar Menu */}
      <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column', position: 'sticky', top: '100px', gap: 'var(--space-2)' }}>
        {[
          { id: 'notes', label: 'My Notes', icon: Info },
          { id: 'goals', label: 'Research Goals', icon: Target },
          { id: 'bundles', label: 'Bundles & Stacks', icon: Layers },
          { id: 'favorites', label: 'Saved Compounds', icon: Heart },
          { id: 'doses', label: 'Dose Tracker', icon: Syringe },
          { id: 'biometrics', label: 'Biometrics', icon: Activity },
          { id: 'progress', label: 'Progress Photos', icon: Camera },
          { id: 'recentlyViewed', label: 'Recently Viewed', icon: History },
          { id: 'compareHistory', label: 'Compare History', icon: Search }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id as any); setShowBuilder(false); setSelectedItems(new Set()); }}
            style={{
              background: activeTab === t.id ? 'rgba(192, 184, 168, 0.1)' : 'transparent',
              border: activeTab === t.id ? '1px solid rgba(192, 184, 168, 0.2)' : '1px solid transparent',
              borderRadius: 8,
              color: activeTab === t.id ? 'var(--teal)' : 'var(--silver)',
              fontWeight: activeTab === t.id ? 'bold' : 'normal',
              padding: '12px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <t.icon size={18} /> {t.label}
          </button>
        ))}
        
        {/* Actions inside sidebar below navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: 'var(--border-subtle)' }}>
          <button onClick={generateLabReport} className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <FlaskConical size={14} /> Print Lab Report
          </button>
          <button onClick={exportJournalToCSV} className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            Export Journal to CSV
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: '1 1 500px', minWidth: 0 }}>

      {activeTab === 'bundles' && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <button 
            className={`btn ${!showBuilder ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowBuilder(false)}
            style={{ borderRadius: 20, padding: '8px 24px' }}
          >
            Pre-Built Famous Stacks
          </button>
          <button 
            className={`btn ${showBuilder ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowBuilder(true)}
            style={{ borderRadius: 20, padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FlaskConical size={16} /> Experiment & Build Custom
          </button>
        </div>
      )}

      {/* Main Content */}
      {activeTab === 'bundles' && showBuilder ? (
        <SmartStackBuilder 
          catalog={catalog} 
          onAddStackToCart={(items, name) => {
            items.forEach(i => handleQuickAdd(i, 1, true));
            toast.success(`Custom Stack "${name}" Added To Cart!`);
          }} 
        />
      ) : (
        <>
          <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', padding: 'var(--space-3)', marginBottom: 'var(--space-6)', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)' }} />
              <input 
                type="text" 
                placeholder="Search Journal..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px 8px 34px', borderRadius: 8, color: 'var(--white)', fontSize: '0.9rem' }}
              />
              {searchQuery && <X size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
            </div>
            
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
              <option value="recent">Recently Added</option>
              <option value="priceAsc">Price: Low to High</option>
              <option value="priceDesc">Price: High to Low</option>
              <option value="alpha">Alphabetical</option>
              {activeTab === 'inventory' && <option value="frequent">Most Frequently Ordered</option>}
            </select>

            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => setViewMode('grid')} style={{ padding: '8px 12px', background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: viewMode === 'grid' ? 'var(--white)' : 'var(--silver)', cursor: 'pointer' }}><LayoutGrid size={16} /></button>
              <button onClick={() => setViewMode('list')} style={{ padding: '8px 12px', background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: viewMode === 'list' ? 'var(--white)' : 'var(--silver)', cursor: 'pointer' }}><ListIcon size={16} /></button>
            </div>
          </div>

          {currentItems.length === 0 && activeTab !== 'notes' && activeTab !== 'compareHistory' && activeTab !== 'doses' && activeTab !== 'biometrics' && activeTab !== 'goals' && activeTab !== 'progress' ? renderEmptyState() : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {activeTab === 'inventory' && (
                <>
                  {/* FRONTIER RADAR / RECOMMENDATIONS */}
                  {(() => {
                    const activeGoalObj = goals.find(g => g.is_active);
                    if (!activeGoalObj) return null;
                    const goalName = activeGoalObj.goal_name;
                    // Find matching key (partial match if needed, but we'll assume exact or substring)
                    const mappingKey = Object.keys(GOAL_MAPPINGS).find(k => goalName.toLowerCase().includes(k.toLowerCase())) || Object.keys(GOAL_MAPPINGS)[0];
                    const recommendedSlugs = GOAL_MAPPINGS[mappingKey] || [];
                    const recommendedItems = catalog.filter(c => recommendedSlugs.some(rs => c.name.toLowerCase().includes(rs.toLowerCase())));
                    
                    if (recommendedItems.length === 0) return null;
                    
                    return (
                      <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ color: 'var(--teal)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Target size={18} /> Frontier Radar: Recommended for "{goalName}"
                        </h3>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto', paddingBottom: 'var(--space-2)' }} className="hide-scrollbar">
                          {recommendedItems.map(item => (
                            <div key={item.product_id} style={{ minWidth: 200, flexShrink: 0, background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 'var(--space-3)', position: 'relative' }}>
                               <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', marginBottom: 'var(--space-3)', background: '#111' }}>
                                  <Image src={item.image_url || getProductImage(null, item.category || 'Other', item.name)} alt={item.name} fill style={{ objectFit: 'cover', mixBlendMode: 'screen' }} />
                                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIntelligenceCompound(item.name); }} style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--white)', padding: '4px 8px', borderRadius: 12, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(4px)' }}><FlaskConical size={12}/> Intel</button>
                               </div>
                               <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--white)' }}>{item.name}</h4>
                               <p style={{ margin: 0, color: 'var(--silver)', fontSize: '0.85rem' }}>{item.category}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
                    <div style={{ flex: '1 1 300px' }}>
                      <h3 style={{ color: 'var(--teal)', marginBottom: 'var(--space-2)' }}>Reconstitution Calculator</h3>
                      <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>Calculate your syringe pull (units) based on vial size and bac water added.</p>
                      
                      <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Load Saved Vial State</label>
                        <select 
                          value={reconProductId || ''} 
                          onChange={e => {
                            const pid = e.target.value;
                            setReconProductId(pid || null);
                            if (pid && inventoryData[pid]) {
                              if (inventoryData[pid].recon_mg) setReconMg(inventoryData[pid].recon_mg as string);
                              if (inventoryData[pid].recon_ml) setReconMl(inventoryData[pid].recon_ml as string);
                              if (inventoryData[pid].recon_dose) setReconDose(inventoryData[pid].recon_dose as string);
                            }
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }}
                        >
                          <option value="">-- Manual Calculation --</option>
                          {Object.keys(inventoryData).map(pid => {
                            const item = [...catalog, ...favorites, ...pastOrders, ...recentlyViewed, ...bundles].find(i => i.product_id === pid);
                            if (!item) return null;
                            return <option key={pid} value={pid}>{item.name}</option>;
                          })}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Vial Size (mg)</label>
                          <input type="number" value={reconMg} onChange={e => handleReconChange('recon_mg', e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Bac Water Added (ml)</label>
                          <input type="number" value={reconMl} onChange={e => handleReconChange('recon_ml', e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Desired Dose (mcg)</label>
                          <input type="number" value={reconDose} onChange={e => handleReconChange('recon_dose', e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,196,188,0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0,196,188,0.2)', padding: 'var(--space-4)' }}>
                      <div style={{ color: 'var(--silver)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: 8 }}>Pull Syringe To</div>
                      <div style={{ color: 'var(--teal)', fontSize: '3rem', fontWeight: 800, lineHeight: 1, textShadow: '0 0 20px rgba(0,196,188,0.3)' }}>
                        {(() => {
                          const mg = parseFloat(reconMg); const ml = parseFloat(reconMl); const dose = parseFloat(reconDose);
                          if (!mg || !ml || !dose) return '0.0';
                          return ((dose * ml * 100) / (mg * 1000)).toFixed(1);
                        })()}
                      </div>
                      <div style={{ color: 'var(--white)', fontSize: '1.2rem', marginTop: 4 }}>Units (IU)</div>
                      <div style={{ color: 'var(--silver)', fontSize: '0.7rem', marginTop: 8, opacity: 0.6 }}>*Assuming standard U-100 syringe</div>
                    </div>
                  </div>

                  {renderGanttChart()}
                  {helpfulData && (
                    <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                      <h3 style={{ color: 'var(--teal)', marginBottom: 'var(--space-2)' }}>Personalized Research Insights</h3>
                      <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>{helpfulData.message}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
                        {helpfulData.insights?.map((insight: any, i: number) => (
                          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ color: 'var(--white)', fontWeight: 'bold', marginBottom: 'var(--space-1)' }}>{insight.compoundName}</div>
                            <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>{insight.insightText}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {activeTab === 'goals' ? (
                <div>
                  <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                    <h2 style={{ color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-2)' }}>
                      <Target size={24} /> Set Your Research Goal
                    </h2>
                    <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Define your primary objective to tailor your lab journal and unlock intelligent compound recommendations.</p>
                    
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <input 
                        type="text" 
                        placeholder="e.g. Muscle Growth, Injury Repair, Cognitive Enhancement" 
                        value={goalName} 
                        onChange={e => setGoalName(e.target.value)}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                      />
                      <button onClick={saveGoal} disabled={!goalName.trim() || goalSaving} className="btn btn-primary" style={{ padding: '8px 24px', whiteSpace: 'nowrap' }}>
                        {goalSaving ? 'Saving...' : 'Add Goal'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <h3 style={{ color: 'var(--white)', marginTop: 'var(--space-2)' }}>Your Active & Past Goals</h3>
                    {goals.length === 0 ? renderEmptyState() : goals.map(g => (
                      <div key={g.id} className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', position: 'relative', border: g.is_active ? '1px solid var(--teal)' : '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
                          {!g.is_active && <button onClick={() => activateGoal(g.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--teal)' }}>Set Active</button>}
                          <button onClick={() => deleteGoal(g.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--red)' }}><Trash2 size={16}/></button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--space-2)' }}>
                          <h4 style={{ margin: 0, fontSize: '1.2rem', color: g.is_active ? 'var(--white)' : 'var(--silver)' }}>{g.goal_name}</h4>
                          {g.is_active && <span style={{ background: 'var(--teal)', color: 'var(--black)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 'bold' }}>ACTIVE</span>}
                        </div>
                        <p style={{ margin: 0, color: 'var(--silver)', fontSize: '0.9rem' }}>Created: {new Date(g.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : activeTab === 'notes' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <button onClick={() => setShowAiBuilder(!showAiBuilder)} className="btn btn-secondary" style={{ padding: '8px 20px', borderRadius: 20 }}>{showAiBuilder ? 'Hide AI Builder' : 'Use AI Builder'}</button>
                    <button onClick={openNewNote} className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: 20 }}>+ Add New Note</button>
                  </div>
                  
                  {showAiBuilder ? (
                    <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
                      <h2 style={{ color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-2)' }}>
                        <Zap size={24} /> Generate 12-Week Protocol
                      </h2>
                      <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-6)' }}>Our AI will generate a structured week-by-week schedule, safety notes, and milestones.</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', marginBottom: 8 }}>Primary Goal</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Tendon Repair and Inflammation Reduction" 
                            value={aiGoal} 
                            onChange={e => setAiGoal(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', marginBottom: 8 }}>Select Compounds</label>
                          <select 
                            multiple
                            value={aiCompounds} 
                            onChange={e => setAiCompounds(Array.from(e.target.selectedOptions, option => option.value))}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem', height: 120 }}
                          >
                            {Array.from(new Set([...favorites, ...pastOrders, ...recentlyViewed].filter(i => i.name).map(i => i.name))).map(slug => (
                              <option key={slug as string} value={slug as string}>{slug}</option>
                            ))}
                          </select>
                          <p style={{ fontSize: '0.8rem', color: 'var(--silver)', marginTop: 4 }}>Hold Cmd/Ctrl to select multiple.</p>
                        </div>
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', marginBottom: 8 }}>Experience Level</label>
                          <select 
                            value={aiExperience} 
                            onChange={e => setAiExperience(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                          >
                            <option value="Beginner">Beginner (First Time Researcher)</option>
                            <option value="Intermediate">Intermediate (1-3 Years)</option>
                            <option value="Advanced">Advanced (3+ Years)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', marginBottom: 8 }}>Subject Metrics (Optional)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 180lbs, 15% body fat, age 35 male" 
                            value={aiMetrics} 
                            onChange={e => setAiMetrics(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                          <button onClick={() => setShowAiBuilder(false)} className="btn btn-ghost" style={{ color: 'var(--silver)' }}>Cancel</button>
                          <button onClick={generateAiProtocol} disabled={aiCompounds.length === 0 || !aiGoal.trim() || isGeneratingAi} className="btn btn-primary" style={{ padding: '8px 24px', background: 'var(--teal)', color: 'var(--black)' }}>
                            {isGeneratingAi ? 'Generating...' : 'Generate AI Protocol'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : isCreatingNote ? (
                    <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
                      <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>{editingNote ? 'Edit Note' : 'New Lab Note'}</h2>
                      
                      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                        <input 
                          type="text" 
                          placeholder="Note Title (Optional)" 
                          value={noteTitle} 
                          onChange={e => setNoteTitle(e.target.value)}
                          style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                        />
                        <select 
                          value={noteCompoundSlug} 
                          onChange={e => setNoteCompoundSlug(e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem', width: 200 }}
                        >
                          <option value="">No Compound Tag</option>
                          {Array.from(new Set([...favorites, ...pastOrders, ...recentlyViewed].filter(i => i.name).map(i => i.name))).map(slug => (
                            <option key={slug as string} value={slug as string}>{slug}</option>
                          ))}
                        </select>
                      </div>
                      
                      <textarea 
                        placeholder="Write your research notes, protocol logs, or observations here..." 
                        value={noteText} 
                        onChange={e => setNoteText(e.target.value)}
                        rows={8}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', marginBottom: 'var(--space-4)', fontSize: '1rem', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                        <button onClick={() => setIsCreatingNote(false)} className="btn btn-ghost" style={{ color: 'var(--silver)' }}>Cancel</button>
                        <button onClick={saveNote} disabled={!noteText.trim() || noteSaving} className="btn btn-primary" style={{ padding: '8px 24px' }}>
                          {noteSaving ? 'Saving...' : 'Save Note'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                    {notes.length === 0 && !isCreatingNote && !showAiBuilder ? renderEmptyState() : notes.map(n => (
                      <div key={n.id} className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
                          <button onClick={() => editNote(n)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--silver)' }}>Edit</button>
                          <button onClick={() => deleteNote(n.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--red)' }}><Trash2 size={16}/></button>
                        </div>
                        {n.compound_slug && (
                          <div style={{ display: 'inline-block', background: 'rgba(0,196,188,0.1)', color: 'var(--teal)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', marginBottom: 'var(--space-2)' }}>
                            #{n.compound_slug}
                          </div>
                        )}
                        <h3 style={{ color: 'var(--white)', paddingRight: 80 }}>{n.title || 'Journal Entry'}</h3>
                        <p style={{ color: 'var(--silver)', whiteSpace: 'pre-wrap', marginTop: 'var(--space-3)' }}>{n.note_text}</p>
                        <div style={{ marginTop: 'var(--space-4)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', paddingTop: 'var(--space-2)' }}>
                          Last updated: {new Date(n.updated_at).toLocaleDateString()} at {new Date(n.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              ) : activeTab === 'doses' ? (
<div>
                  {/* Stat Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                    <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <div style={{ width: 72, height: 72, position: 'relative', flexShrink: 0 }}>
                        <AdherenceRing adherence={doseStats.adherence} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)', fontWeight: 800, fontSize: '1rem' }}>
                          {doseStats.adherence != null ? `${doseStats.adherence}%` : '--'}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--silver)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Adherence 30D</div>
                        <div style={{ color: 'var(--white)', fontSize: '0.85rem', marginTop: 4 }}>{doseStats.adherence != null ? `${doseStats.last30} Of ~${doseStats.expected30} Planned` : 'Add A Protocol'}</div>
                      </div>
                    </div>
                    {statCard('Current Streak', <span>{doseStats.streak}<span style={{ fontSize: '0.9rem', color: 'var(--silver)', fontWeight: 400 }}> Days</span></span>, doseStats.streak > 0 ? 'Keep It Going' : 'Log Today To Start', Flame, '#F6AD55')}
                    {statCard('Active Compounds', doseStats.activeCompounds, 'Being Tracked', Beaker)}
                    {statCard('Doses This Week', doseStats.last7, `${doseStats.total} All Time`, Syringe)}
                  </div>

                  {/* Week In Review + Signals */}
                  {weekReview.hasData && (
                    <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', background: 'linear-gradient(135deg, rgba(0,196,188,0.06), rgba(0,0,0,0))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
                        <Zap size={20} style={{ color: 'var(--teal)' }} />
                        <h3 style={{ color: 'var(--white)', margin: 0 }}>Week In Review</h3>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: insights.length ? 'var(--space-5)' : 0 }}>
                        <div>
                          <div style={{ color: 'var(--silver)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Doses This Week</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ color: 'var(--white)', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-brand)' }}>{weekReview.dosesThisWeek}</span>
                            {weekReview.doseDelta !== 0 && (
                              <span style={{ color: weekReview.doseDelta > 0 ? 'var(--teal)' : 'var(--silver)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 2 }}>
                                {weekReview.doseDelta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {weekReview.doseDelta > 0 ? '+' : ''}{weekReview.doseDelta} Vs Last Week
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--silver)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Adherence</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ color: 'var(--white)', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-brand)' }}>{weekReview.adherenceThis != null ? `${weekReview.adherenceThis}%` : '--'}</span>
                            {weekReview.adherenceThis != null && weekReview.adherencePrior != null && (
                              <span style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>Vs {weekReview.adherencePrior}% Prior</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--silver)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Streak</div>
                          <div style={{ color: 'var(--white)', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-brand)' }}>{doseStats.streak} <span style={{ fontSize: '0.85rem', color: 'var(--silver)', fontWeight: 400 }}>Days</span></div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--silver)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Site This Week</div>
                          <div style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700, marginTop: 4 }}>{weekReview.topSite ? `${weekReview.topSite.name}` : 'None Logged'}</div>
                          {weekReview.topSite && <div style={{ color: 'var(--silver)', fontSize: '0.78rem' }}>{weekReview.topSite.count} Times · {weekReview.topSite.share}%</div>}
                        </div>
                      </div>
                      {insights.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {insights.map((ins, i) => {
                            const c = ins.tone === 'good' ? 'var(--teal)' : ins.tone === 'warn' ? '#F6AD55' : 'var(--silver)';
                            const Ico = ins.tone === 'good' ? Check : ins.tone === 'warn' ? Info : Activity;
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${ins.tone === 'warn' ? 'rgba(246,173,85,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: '10px 14px' }}>
                                <Ico size={16} style={{ color: c, flexShrink: 0, marginTop: 1 }} />
                                <span style={{ color: 'var(--white)', fontSize: '0.88rem', lineHeight: 1.4 }}>{ins.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="dose-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                    <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
                      <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}><Syringe size={20} style={{ color: 'var(--teal)' }} /> Log A Dose</h2>

                      {doses.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                          <span style={{ color: 'var(--silver)', fontSize: '0.8rem', alignSelf: 'center' }}>Quick Repeat:</span>
                          {Array.from(new Map(doses.map(d => [d.compound_slug, d])).values()).slice(0, 4).map((d: any) => (
                            <button key={d.id} onClick={() => repeatLastDose(d)} disabled={doseSaving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.25)', color: 'var(--teal)', padding: '5px 12px', borderRadius: 999, fontSize: '0.8rem', cursor: 'pointer' }}>
                              <Repeat size={12} /> {d.compound_slug} {d.dose_amount}{d.unit}
                            </button>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                          value={doseCompound}
                          onChange={e => {
                            const cmp = e.target.value;
                            setDoseCompound(cmp);
                            const lastDose = doses.find(d => d.compound_slug === cmp);
                            if (lastDose) {
                              setDoseAmount(lastDose.dose_amount.toString());
                              setDoseUnit(lastDose.unit);
                            } else {
                              setDoseAmount('');
                            }
                          }}
                          style={{ flex: 1, minWidth: 180, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                        >
                          <option value="">Select Compound</option>
                          {Array.from(new Set([...favorites, ...pastOrders, ...recentlyViewed].filter(i => i.name).map(i => i.name))).map(slug => (
                            <option key={slug as string} value={slug as string}>{slug}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Amount"
                          value={doseAmount}
                          onChange={e => setDoseAmount(e.target.value)}
                          style={{ width: 110, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                        />
                        <select
                          value={doseUnit}
                          onChange={e => setDoseUnit(e.target.value)}
                          style={{ width: 90, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                        >
                          <option value="mcg">mcg</option>
                          <option value="mg">mg</option>
                          <option value="iu">IU</option>
                          <option value="ml">ml</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder="Optional Note (Site Soreness, Timing, Context)"
                        value={doseNote}
                        onChange={e => setDoseNote(e.target.value)}
                        style={{ width: '100%', marginTop: 'var(--space-3)', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px', borderRadius: 8, color: 'var(--white)', fontSize: '0.9rem' }}
                      />
                      <button onClick={saveDose} disabled={!doseCompound || !doseAmount || doseSaving || !selectedSite} className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-3)', padding: '12px 24px', borderRadius: 8 }}>
                        {doseSaving ? 'Saving...' : selectedSite ? `Log Dose To ${selectedSite.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}` : 'Log Dose'}
                      </button>
                      {!selectedSite && <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> Select An Injection Site To Log A Dose.</div>}
                    </div>

                    <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                      <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-3)', textAlign: 'center', fontSize: '1rem' }}>Injection Site Rotation</h3>
                      {(() => {
                        // Sites mapped to % coords on the real body image (2:3 ratio, 840×1260 intrinsic)
                        // Image: shoulders ~22% from top, triceps ~35%, abdomen ~52%
                        const SITES = [
                          { id: 'left_deltoid',  x: 26,  y: 22,  label: 'L Shoulder' },
                          { id: 'right_deltoid', x: 74,  y: 22,  label: 'R Shoulder' },
                          { id: 'left_tricep',   x: 18,  y: 36,  label: 'L Tricep'   },
                          { id: 'right_tricep',  x: 82,  y: 36,  label: 'R Tricep'   },
                          { id: 'left_abdomen',  x: 43,  y: 52,  label: 'L Abdomen'  },
                          { id: 'right_abdomen', x: 57,  y: 52,  label: 'R Abdomen'  },
                        ];
                        const suggestion = [...SITES].sort((a, b) => {
                          const la = computedInjectionSites[a.id] || 0;
                          const lb = computedInjectionSites[b.id] || 0;
                          return la - lb;
                        })[0];
                        return (
                          <>
                            {/* Real anatomical image with dot overlay */}
                            <div style={{ position: 'relative', width: '100%', maxWidth: 240, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="/images/injection-site-body.jpg"
                                alt="Injection site body map"
                                style={{ width: '100%', display: 'block', borderRadius: 12 }}
                              />
                              {/* Interactive dot overlay */}
                              <div style={{ position: 'absolute', inset: 0 }}>
                                {SITES.map(site => {
                                  const lastUsed = computedInjectionSites[site.id];
                                  const daysSince = lastUsed ? (Date.now() - lastUsed) / 86400000 : Infinity;
                                  let color = '#00c4bc';
                                  let glow = '0 0 0 3px rgba(0,196,188,0.3), 0 0 12px rgba(0,196,188,0.5)';
                                  if (daysSince < 2) { color = '#ef4444'; glow = '0 0 0 3px rgba(239,68,68,0.3), 0 0 12px rgba(239,68,68,0.6)'; }
                                  else if (daysSince < 5) { color = '#eab308'; glow = '0 0 0 3px rgba(234,179,8,0.3), 0 0 12px rgba(234,179,8,0.5)'; }
                                  const isSel = selectedSite === site.id;
                                  const isSuggested = suggestion && site.id === suggestion.id && daysSince >= 5;
                                  const dotSize = isSel ? 22 : 16;
                                  return (
                                    <button
                                      key={site.id}
                                      onClick={() => setSelectedSite(site.id === selectedSite ? '' : site.id)}
                                      title={`${site.label}${lastUsed ? ` — ${Math.round(daysSince)}d ago` : ' — Never Used'}`}
                                      style={{
                                        position: 'absolute',
                                        left: `${site.x}%`,
                                        top: `${site.y}%`,
                                        transform: 'translate(-50%, -50%)',
                                        width: dotSize,
                                        height: dotSize,
                                        borderRadius: '50%',
                                        background: color,
                                        border: isSel ? '2.5px solid #fff' : `1.5px solid ${color}`,
                                        cursor: 'pointer',
                                        boxShadow: isSuggested ? `${glow}, 0 0 0 6px rgba(0,196,188,0.15)` : glow,
                                        transition: 'all 0.18s ease',
                                        animation: isSuggested ? 'pulse-site 1.8s ease-in-out infinite' : 'none',
                                        padding: 0,
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>

                            {/* Labels row */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12, fontSize: '0.72rem', color: 'var(--silver)', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} /> &lt;2d (rest)</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} /> 2-5d</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00c4bc' }} /> Ready</div>
                            </div>

                            {/* Site legend */}
                            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                              {SITES.map(site => {
                                const lastUsed = computedInjectionSites[site.id];
                                const daysSince = lastUsed ? Math.round((Date.now() - lastUsed) / 86400000) : null;
                                const isSel = selectedSite === site.id;
                                return (
                                  <button
                                    key={site.id}
                                    onClick={() => setSelectedSite(site.id === selectedSite ? '' : site.id)}
                                    style={{
                                      background: isSel ? 'rgba(0,196,188,0.12)' : 'rgba(255,255,255,0.03)',
                                      border: `1px solid ${isSel ? 'rgba(0,196,188,0.4)' : 'rgba(255,255,255,0.07)'}`,
                                      borderRadius: 6,
                                      padding: '4px 8px',
                                      color: isSel ? 'var(--teal)' : 'var(--silver)',
                                      fontSize: '0.72rem',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      fontWeight: isSel ? 700 : 400,
                                    }}
                                  >
                                    {site.label}{daysSince !== null ? <span style={{ opacity: 0.6 }}> · {daysSince}d</span> : ''}
                                  </button>
                                );
                              })}
                            </div>

                            {suggestion && (
                              <div style={{ textAlign: 'center', marginTop: 10, color: 'var(--teal)', fontSize: '0.8rem' }}>
                                Suggested Next: <strong>{suggestion.label}</strong>
                                {computedInjectionSites[suggestion.id] ? ` (${Math.round((Date.now() - computedInjectionSites[suggestion.id]) / 86400000)}d Rest)` : ' (Never Used)'}
                              </div>
                            )}
                            {selectedSite && (
                              <div style={{ textAlign: 'center', marginTop: 8, color: 'var(--white)', fontWeight: 700, fontSize: '0.85rem' }}>
                                ✓ Selected: {selectedSite.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Active In System curve */}
                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-2)' }}>
                      <h3 style={{ color: 'var(--white)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} style={{ color: 'var(--teal)' }} /> Estimated Concentration Model</h3>
                      {rangeSwitcher(doseRange, setDoseRange)}
                    </div>
                    <p style={{ color: 'var(--silver)', fontSize: '0.8rem', marginTop: 0, marginBottom: 'var(--space-4)' }}>Informational Half-Life Decay Estimate, Normalized Per Compound To Its Own Peak. Dashed Region Is Projected.</p>
                    {activeInSystem.data.length > 0 ? (
                      <div style={{ width: '100%', height: 320 }}>
                        <ActiveInSystemChart data={activeInSystem.data} compounds={activeInSystem.compounds} colors={CHART_COLORS} />
                      </div>
                    ) : <div style={{ color: 'var(--silver)', padding: 'var(--space-4)' }}>Log Doses To See Your Estimated Concentration Curve.</div>}
                  </div>

                  {/* Dose Calendar Heatmap */}
                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', overflowX: 'auto' }}>
                    <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={18} style={{ color: 'var(--teal)' }} /> Consistency Calendar</h3>
                    <div style={{ display: 'flex', gap: 4, minWidth: 'fit-content' }}>
                      {calendarWeeks.map((week, wi) => (
                        <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {week.map(day => {
                            const isFuture = day.date.getTime() > Date.now();
                            let bg = 'rgba(255,255,255,0.05)';
                            if (!isFuture && day.count === 1) bg = 'rgba(0,196,188,0.45)';
                            else if (!isFuture && day.count >= 2) bg = 'var(--teal)';
                            return <div key={day.key} title={`${day.date.toLocaleDateString()} - ${day.count} Dose${day.count === 1 ? '' : 's'}`} style={{ width: 14, height: 14, borderRadius: 3, background: bg, opacity: isFuture ? 0.25 : 1 }} />;
                          })}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: '0.72rem', color: 'var(--silver)' }}>
                      Less
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(255,255,255,0.05)' }} />
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(0,196,188,0.45)' }} />
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--teal)' }} />
                      More
                    </div>
                  </div>

                  {/* Interactive Cycle Timeline (from purchase history) */}
                  {renderGanttChart()}

                  {/* Protocol Scheduler */}
                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-4)' }}>
                      <h3 style={{ color: 'var(--white)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={18} style={{ color: 'var(--teal)' }} /> Protocol Scheduler</h3>
                      {/* Push Notification toggle */}
                      <button
                        onClick={requestNotifPermission}
                        disabled={notifPermission === 'granted' || notifPermission === 'unsupported'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: notifPermission === 'granted' ? 'rgba(0,196,188,0.1)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${notifPermission === 'granted' ? 'rgba(0,196,188,0.35)' : 'rgba(255,255,255,0.12)'}`,
                          color: notifPermission === 'granted' ? 'var(--teal)' : 'var(--silver)',
                          padding: '6px 14px', borderRadius: 999, fontSize: '0.8rem', cursor: notifPermission === 'granted' ? 'default' : 'pointer',
                        }}
                      >
                        {notifPermission === 'granted' ? <Bell size={14} /> : <BellOff size={14} />}
                        {notifPermission === 'granted' ? 'Alerts On' : notifPermission === 'unsupported' ? 'Unsupported' : 'Enable Dose Alerts'}
                      </button>
                    </div>

                    {scheduledDoses.length > 0 && (() => {
                      const due = scheduledDoses.filter(s => scheduleDueStatus(s).status === 'due');
                      return (
                        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', borderRadius: 8, background: due.length ? 'rgba(0,196,188,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${due.length ? 'rgba(0,196,188,0.25)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {due.length > 0 ? <Zap size={16} style={{ color: 'var(--teal)' }} /> : <Check size={16} style={{ color: 'var(--silver)' }} />}
                            <span style={{ color: 'var(--white)', fontSize: '0.9rem' }}>
                              {due.length > 0 ? `${due.length} Protocol${due.length === 1 ? '' : 's'} Due Today: ${due.map(s => s.compound_slug || s.compound).join(', ')}` : 'Nothing Due Today. You Are On Track.'}
                            </span>
                          </div>
                          {due.length > 0 && notifPermission === 'granted' && (
                            <button
                              onClick={() => due.forEach(s => sendDoseReminder(s.compound_slug || s.compound))}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.3)', color: 'var(--teal)', padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', cursor: 'pointer' }}
                            >
                              <Bell size={12} /> Send Reminder
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                      <select 
                        onChange={e => {
                          const t = PROTOCOL_TEMPLATES[parseInt(e.target.value)];
                          if (t) {
                            setScheduleCompound(t.compound);
                            setScheduleAmount(t.amount);
                            setScheduleUnit(t.unit);
                            setScheduleFrequency(t.frequency);
                          }
                        }} 
                        style={{ flex: 1, minWidth: '100%', background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', padding: '12px', borderRadius: 8, color: 'var(--teal)', fontWeight: 'bold' }}
                      >
                        <option value="">+ Load from Protocol Library</option>
                        {PROTOCOL_TEMPLATES.map((t, i) => (
                          <option key={i} value={i}>{t.name} ({t.compound} {t.amount}{t.unit} {t.frequency})</option>
                        ))}
                      </select>
                      
                      <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

                      <select value={scheduleCompound} onChange={e => setScheduleCompound(e.target.value)} style={{ flex: 1, minWidth: 200, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)' }}>
                        <option value="">Select Compound</option>
                        {Array.from(new Set([...favorites, ...pastOrders, ...recentlyViewed].filter(i => i.name).map(i => i.name))).map(slug => (<option key={slug as string} value={slug as string}>{slug}</option>))}
                      </select>
                      <input type="number" placeholder="Amount" value={scheduleAmount} onChange={e => setScheduleAmount(e.target.value)} style={{ width: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)' }} />
                      <select value={scheduleUnit} onChange={e => setScheduleUnit(e.target.value)} style={{ width: 90, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)' }}>
                        <option value="mcg">mcg</option><option value="mg">mg</option><option value="iu">IU</option><option value="ml">ml</option>
                      </select>
                      <select value={scheduleFrequency} onChange={e => setScheduleFrequency(e.target.value)} style={{ width: 160, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)' }}>
                        <option value="Every Day">Every Day</option>
                        <option value="Every Other Day">Every Other Day</option>
                        <option value="5 Days On, 2 Off">5 Days On, 2 Off</option>
                        <option value="Once Weekly">Once Weekly</option>
                        <option value="Twice Weekly">Twice Weekly</option>
                        <option value="Every 5 Days">Every 5 Days</option>
                        <option value="Every 10 Days">Every 10 Days</option>
                        <option value="Cycle Off">Cycle Off (Paused)</option>
                      </select>
                      <button onClick={addScheduledDose} disabled={!scheduleCompound || !scheduleAmount} className="btn btn-secondary" style={{ padding: '12px 24px', borderRadius: 8 }}>Add Schedule</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                      {scheduledDoses.map(s => {
                        const st = scheduleDueStatus(s);
                        const isDue = st.status === 'due';
                        const isCycleOff = (s.frequency || '').toLowerCase().includes('cycle off') || (s.frequency || '').toLowerCase().includes('paused');
                        return (
                          <div key={s.id} style={{ background: isDue ? 'rgba(0,196,188,0.06)' : 'rgba(255,255,255,0.04)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', position: 'relative', border: `1px solid ${isDue ? 'rgba(0,196,188,0.2)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button onClick={() => deleteScheduledDose(s.id)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer' }} title="Remove protocol"><X size={14} /></button>
                            <div style={{ color: 'var(--teal)', fontWeight: 700, fontSize: '0.95rem', paddingRight: 20 }}>{s.compound_slug || s.compound}</div>
                            <div style={{ color: 'var(--white)', fontSize: '0.88rem' }}>{s.amount} {s.unit}</div>
                            {/* Frequency badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: isCycleOff ? 'rgba(239,68,68,0.1)' : 'rgba(0,196,188,0.08)', border: `1px solid ${isCycleOff ? 'rgba(239,68,68,0.25)' : 'rgba(0,196,188,0.2)'}`, borderRadius: 6, padding: '3px 8px', width: 'fit-content' }}>
                              <Clock size={11} style={{ color: isCycleOff ? '#ef4444' : 'var(--teal)', flexShrink: 0 }} />
                              <span style={{ color: isCycleOff ? '#ef4444' : 'var(--teal)', fontSize: '0.72rem', fontWeight: 600 }}>{freqLabel(s.frequency)}</span>
                            </div>
                            {/* Due status + notification bell */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {st.label && (() => {
                                const color = isDue ? 'var(--black)' : st.status === 'logged' ? '#68D391' : 'var(--silver)';
                                const bg = isDue ? 'var(--teal)' : 'rgba(255,255,255,0.06)';
                                return <div style={{ fontSize: '0.68rem', fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{st.label}</div>;
                              })()}
                              {isDue && notifPermission === 'granted' && (
                                <button
                                  onClick={() => sendDoseReminder(s.compound_slug || s.compound)}
                                  title="Send push reminder"
                                  style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', padding: 2 }}
                                >
                                  <Bell size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {scheduledDoses.length === 0 && <div style={{ color: 'var(--silver)', gridColumn: '1/-1' }}>No Scheduled Protocols Yet. Add One To Track Adherence.</div>}
                    </div>
                  </div>

                  {/* Reconstitution Calculator (moved from Inventory) */}
                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
                    <div style={{ flex: '1 1 300px' }}>
                      <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 8 }}><Beaker size={18} style={{ color: 'var(--teal)' }} /> Reconstitution Calculator</h3>
                      <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>Calculate Your Syringe Pull Based On Vial Size And Bac Water Added.</p>
                      
                      <div style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Load Saved Vial State</label>
                        <select 
                          value={reconProductId || ''} 
                          onChange={e => {
                            const pid = e.target.value;
                            setReconProductId(pid || null);
                            if (pid && inventoryData[pid]) {
                              if (inventoryData[pid].recon_mg) setReconMg(inventoryData[pid].recon_mg as string);
                              if (inventoryData[pid].recon_ml) setReconMl(inventoryData[pid].recon_ml as string);
                              if (inventoryData[pid].recon_dose) setReconDose(inventoryData[pid].recon_dose as string);
                            }
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }}
                        >
                          <option value="">-- Manual Calculation --</option>
                          {Object.keys(inventoryData).map(pid => {
                            const item = [...catalog, ...favorites, ...pastOrders, ...recentlyViewed, ...bundles].find(i => i.product_id === pid);
                            if (!item) return null;
                            return <option key={pid} value={pid}>{item.name}</option>;
                          })}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Vial Size (mg)</label>
                          <input type="number" value={reconMg} onChange={e => handleReconChange('recon_mg', e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Bac Water (ml)</label>
                          <input type="number" value={reconMl} onChange={e => handleReconChange('recon_ml', e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Desired Dose (mcg)</label>
                          <input type="number" value={reconDose} onChange={e => handleReconChange('recon_dose', e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: 'var(--white)' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,196,188,0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0,196,188,0.2)', padding: 'var(--space-4)' }}>
                      <div style={{ color: 'var(--silver)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: 8 }}>Pull Syringe To</div>
                      <div style={{ color: 'var(--teal)', fontSize: '3rem', fontWeight: 800, lineHeight: 1, textShadow: '0 0 20px rgba(0,196,188,0.3)' }}>
                        {(() => {
                          const mg = parseFloat(reconMg); const ml = parseFloat(reconMl); const dose = parseFloat(reconDose);
                          if (!mg || !ml || !dose) return '0.0';
                          return ((dose * ml * 100) / (mg * 1000)).toFixed(1);
                        })()}
                      </div>
                      <div style={{ color: 'var(--white)', fontSize: '1.2rem', marginTop: 4 }}>Units (IU)</div>
                      <div style={{ color: 'var(--silver)', fontSize: '0.7rem', marginTop: 8, opacity: 0.6 }}>*Assuming Standard U-100 Syringe</div>
                    </div>
                  </div>

                  {/* Recent History */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 8 }}><History size={18} style={{ color: 'var(--teal)' }} /> Recent History</h3>
                    {doses.slice(0, 40).map(d => (
                      <div key={d.id} className="glass-panel" style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'var(--teal)', fontWeight: 700 }}>{d.compound_slug}</div>
                          <div style={{ color: 'var(--white)', fontSize: '0.95rem' }}>{d.dose_amount} {d.unit}
                            {d.injection_site && <span style={{ color: 'var(--silver)', fontSize: '0.8rem' }}> · {String(d.injection_site).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>}
                          </div>
                          {d.notes && <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginTop: 2, fontStyle: 'italic' }}>{d.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
                          <div style={{ color: 'var(--silver)', fontSize: '0.82rem', textAlign: 'right' }}>
                            {new Date(d.dosed_at).toLocaleDateString()}<br />{new Date(d.dosed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <button onClick={() => deleteDose(d.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--red)' }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                    {doses.length === 0 && <div style={{ color: 'var(--silver)' }}>No Doses Logged Yet.</div>}
                  </div>
                </div>

              ) : activeTab === 'biometrics' ? (
<div>
                  {/* Quick Log */}
                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                    <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={20} style={{ color: 'var(--teal)' }} /> Log Biometrics</h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                      {BIOMETRIC_PRESETS.map(p => {
                        const active = bioName === p.name;
                        const PIcon = p.icon;
                        return (
                          <button key={p.name} onClick={() => { setBioName(p.name); setBioUnit(p.unit); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: active ? 'var(--teal)' : 'rgba(255,255,255,0.04)', color: active ? 'var(--black)' : 'var(--silver)', border: `1px solid ${active ? 'var(--teal)' : 'rgba(255,255,255,0.1)'}`, padding: '6px 12px', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', fontWeight: active ? 700 : 500 }}>
                            <PIcon size={13} /> {p.name}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Metric Name"
                        value={bioName}
                        onChange={e => setBioName(e.target.value)}
                        style={{ flex: 1, minWidth: 160, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                      />
                      <input
                        type="number"
                        placeholder="Value"
                        value={bioValue}
                        onChange={e => setBioValue(e.target.value)}
                        style={{ width: 120, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={bioUnit}
                        onChange={e => setBioUnit(e.target.value)}
                        style={{ width: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: 8, color: 'var(--white)', fontSize: '1rem' }}
                      />
                      <button onClick={saveBiometric} disabled={!bioName || !bioValue || bioSaving} className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: 8 }}>
                        {bioSaving ? 'Saving...' : 'Log'}
                      </button>
                    </div>
                    
                    <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>
                        Have data from Apple Health or Google Fit?
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--white)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Bulk Import CSV
                        <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
                      </label>
                    </div>
                  </div>

                  {/* Metric Stat Cards */}
                  {trackedMetrics.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                      {trackedMetrics.map(metric => {
                        const s = metricStats(metric);
                        if (!s) return null;
                        const deltaColor = (d: number) => {
                          if (d === 0 || s.better === 'none') return 'var(--silver)';
                          const good = s.better === 'up' ? d > 0 : d < 0;
                          return good ? 'var(--teal)' : 'var(--red)';
                        };
                        const fmt = (d: number) => `${d > 0 ? '+' : ''}${Math.round(d * 100) / 100}`;
                        return (
                          <div key={metric} className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ color: 'var(--silver)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{metric}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              <div style={{ color: 'var(--white)', fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-brand)' }}>{s.current}</div>
                              <div style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>{s.unit}</div>
                            </div>
                            <div style={{ height: 34, margin: '6px 0' }}>
                              <MetricSparkline spark={s.spark} metric={metric} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                              <span style={{ color: deltaColor(s.d7), display: 'flex', alignItems: 'center', gap: 2 }}>
                                {s.d7 >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {fmt(s.d7)} 7D
                              </span>
                              <span style={{ color: deltaColor(s.d30) }}>{fmt(s.d30)} 30D</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Trend Charts */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ color: 'var(--white)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={18} style={{ color: 'var(--teal)' }} /> Trends & Protocol Correlation</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {trackedMetrics.length > 1 && (
                        <select value={bioMetricFilter} onChange={e => setBioMetricFilter(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '6px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
                          <option value="">All Metrics</option>
                          {trackedMetrics.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      )}
                      {rangeSwitcher(bioRange, setBioRange)}
                    </div>
                  </div>
                  {trackedMetrics.length === 0 ? (
                    <div className="glass-panel" style={{ padding: 'var(--space-8)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                      <Activity size={44} style={{ color: 'var(--teal)', opacity: 0.7, marginBottom: 'var(--space-3)' }} />
                      <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)' }}>No Biometrics Logged Yet</h3>
                      <p style={{ color: 'var(--silver)', maxWidth: 420, margin: '0 auto' }}>Pick A Metric Above And Log Your First Reading To Unlock Trend Lines, Deltas, And Dose Correlation.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                      {(bioMetricFilter ? [bioMetricFilter] : trackedMetrics).map(metric => renderBioTrendChart(metric))}
                    </div>
                  )}

                  {/* Dose-Day vs Off-Day Impact Comparison */}
                  {doseImpacts.length > 0 && (
                    <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginTop: 'var(--space-6)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-2)' }}>
                        <Layers size={18} style={{ color: 'var(--teal)' }} />
                        <h3 style={{ color: 'var(--white)', margin: 0 }}>Dose-Day Impact</h3>
                      </div>
                      <p style={{ color: 'var(--silver)', fontSize: '0.8rem', marginTop: 0, marginBottom: 'var(--space-5)' }}>Average Reading On Days You Logged A Dose Versus Days You Did Not. This Is An Association In Your Own Log, Not Proof Of Cause.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                        {doseImpacts.map(imp => {
                          const max = Math.max(imp.onAvg, imp.offAvg, 0.0001);
                          const preset = BIOMETRIC_PRESETS.find(p => p.name === imp.metric);
                          const better = preset?.better || 'none';
                          const good = better === 'none' ? null : (better === 'up' ? imp.delta > 0 : imp.delta < 0);
                          const deltaColor = good == null ? 'var(--silver)' : good ? 'var(--teal)' : '#F6AD55';
                          const bar = (label: string, val: number, n: number, color: string) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 96, flexShrink: 0, color: 'var(--silver)', fontSize: '0.8rem', textAlign: 'right' }}>{label} <span style={{ opacity: 0.6 }}>({n})</span></div>
                              <div style={{ flex: 1, height: 26, background: 'rgba(255,255,255,0.04)', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
                                <div style={{ width: `${(val / max) * 100}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.4s' }} />
                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--white)', fontSize: '0.82rem', fontWeight: 700 }}>{val} {imp.unit}</span>
                              </div>
                            </div>
                          );
                          return (
                            <div key={imp.metric}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                                <span style={{ color: 'var(--white)', fontWeight: 700 }}>{imp.metric}</span>
                                <span style={{ color: deltaColor, fontSize: '0.82rem', fontWeight: 600 }}>{imp.delta > 0 ? '+' : ''}{imp.delta} {imp.unit} On Dose Days</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {bar('Dose Days', imp.onAvg, imp.onN, 'var(--teal)')}
                                {bar('Off Days', imp.offAvg, imp.offN, 'rgba(208,218,228,0.4)')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recent list */}
                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginTop: 'var(--space-6)' }}>
                    <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}><History size={18} style={{ color: 'var(--teal)' }} /> Recent Biometrics</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {[...biometrics].sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()).slice(0, 40).map(b => (
                        <div key={b.id} className="glass-panel" style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                          <div>
                            <div style={{ color: 'var(--teal)', fontWeight: 700 }}>{b.metric_name}</div>
                            <div style={{ color: 'var(--white)' }}>{b.metric_value} {b.unit}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <div style={{ color: 'var(--silver)', fontSize: '0.82rem', textAlign: 'right' }}>
                              {new Date(b.measured_at).toLocaleDateString()}<br />{new Date(b.measured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <button onClick={() => deleteBiometric(b.id)} className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--red)' }}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                      {biometrics.length === 0 && <div style={{ color: 'var(--silver)' }}>No Biometrics Logged Yet.</div>}
                    </div>
                  </div>
                </div>

              ) : activeTab === 'progress' ? (
                <div>
                  <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                    <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 8 }}><Camera size={20} style={{ color: 'var(--teal)' }} /> Progress Photos</h2>
                    <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginTop: 0, marginBottom: 'var(--space-4)' }}>Pin Dated Photos To Your Protocol Timeline To Track Visible Change Over A Cycle. Private To Your Account.</p>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Caption (Optional)</label>
                        <input type="text" placeholder="e.g. Week 4, Front" value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} maxLength={300} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px', borderRadius: 8, color: 'var(--white)' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 4 }}>Date Taken</label>
                        <input type="date" value={photoDate} onChange={e => setPhotoDate(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px', borderRadius: 8, color: 'var(--white)' }} />
                      </div>
                      <label className="btn btn-primary" style={{ padding: '11px 22px', borderRadius: 8, cursor: photoUploading ? 'wait' : 'pointer', opacity: photoUploading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Camera size={16} /> {photoUploading ? 'Uploading...' : 'Add Photo'}
                        <input type="file" accept="image/*" disabled={photoUploading} onChange={e => { uploadProgressPhoto(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>

                  {progressPhotos.length === 0 ? (
                    <div className="glass-panel" style={{ padding: 'var(--space-8)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                      <Camera size={44} style={{ color: 'var(--teal)', opacity: 0.7, marginBottom: 'var(--space-3)' }} />
                      <h3 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)' }}>No Progress Photos Yet</h3>
                      <p style={{ color: 'var(--silver)', maxWidth: 420, margin: '0 auto' }}>Add Your First Dated Photo Above. They Stay Private And Are Ordered On Your Timeline So You Can Compare Across A Cycle.</p>
                    </div>
                  ) : (
                    Object.entries(
                      progressPhotos.reduce((acc: Record<string, any[]>, p) => {
                        const key = new Date(p.taken_at + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
                        (acc[key] = acc[key] || []).push(p);
                        return acc;
                      }, {})
                    ).map(([month, photos]) => (
                      <div key={month} style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ color: 'var(--silver)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>{month}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                          {(photos as any[]).map(p => (
                            <div key={p.id} className="glass-panel" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative' }}>
                              <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', background: 'rgba(0,0,0,0.4)' }}>
                                {p.url ? (
                                  <img src={p.url} alt={p.caption || 'Progress Photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--silver)', fontSize: '0.8rem' }}>Image Unavailable</div>
                                )}
                                <button onClick={() => deleteProgressPhoto(p.id)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--red)' }}><Trash2 size={15} /></button>
                              </div>
                              <div style={{ padding: 'var(--space-3)' }}>
                                <div style={{ color: 'var(--white)', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.caption || 'Untitled'}</div>
                                <div style={{ color: 'var(--silver)', fontSize: '0.75rem', marginTop: 2 }}>{new Date(p.taken_at + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

              ) : activeTab === 'compareHistory' ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {comparisons.length === 0 ? renderEmptyState() : comparisons.map(c => (
                      <div key={c.id} className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                          <div>
                            {c.folder_name && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,196,188,0.15)', color: 'var(--teal)', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, border: '1px solid rgba(0,196,188,0.3)' }}>
                                <Layers size={12} /> {c.folder_name}
                              </div>
                            )}
                            <h3 style={{ color: 'var(--white)', margin: 0 }}>Comparison from {new Date(c.created_at).toLocaleDateString()}</h3>
                            {c.notes && (
                              <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginTop: 8, fontStyle: 'italic', maxWidth: '600px' }}>
                                {`"${c.notes}"`}
                              </p>
                            )}
                          </div>
                          <button onClick={() => deleteComparison(c.id)} className="btn btn-ghost btn-sm" style={{ padding: 6, color: 'var(--red)', background: 'rgba(229,62,62,0.1)' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
                          {c.product_ids.map((pid: string) => {
                            const item = [...favorites, ...pastOrders, ...recentlyViewed, ...catalog].find(i => i.product_id === pid);
                            if (!item) return <div key={pid} style={{ color: 'var(--silver)' }}>Unknown Item</div>;
                            return (
                              <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'rgba(255,255,255,0.05)', padding: 'var(--space-2) var(--space-3)', borderRadius: 20, whiteSpace: 'nowrap' }}>
                                <Image src={item.image_url || getProductImage(null, item.category || 'Other', item.name)} width={24} height={24} unoptimized style={{ objectFit: 'contain', borderRadius: 4 }} alt={item.name} />
                                <div style={{ color: 'var(--white)', fontSize: '0.9rem', fontWeight: 600 }}>{item.name}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                        <button onClick={() => { setSelectedItems(new Set(c.product_ids)); setIsComparing(true); }} className="btn btn-secondary btn-sm" style={{ padding: '6px 16px', borderRadius: 20 }}>View Comparison Again</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
              {activeTab === 'recentlyViewed' && recentlyViewed.length > 0 && !searchQuery && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-var(--space-4)' }}>
                  <button onClick={clearRecentlyViewed} className="btn btn-ghost btn-sm" style={{ color: 'var(--silver)', fontSize: '0.8rem', padding: '4px 12px' }}>Clear History</button>
                </div>
              )}
              {activeTab === 'inventory' && !searchQuery && (
                <div className="glass-panel" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <PackageOpen size={18} style={{ color: 'var(--teal)' }} />
                    <span style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>Looking for a specific receipt or tracking number?</span>
                  </div>
                  <Link href="/orders" className="btn btn-ghost btn-sm" style={{ color: 'var(--white)', whiteSpace: 'nowrap' }}>
                    View Full Order History &rarr;
                  </Link>
                </div>
              )}
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category}>
                  {shouldGroup && <h3 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)' }}>{category}</h3>}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : '1fr',
                    gap: 'var(--space-3)'
                  }}>
                    {items.map((item, idx) => renderItemCard(item, idx))}
                  </div>
                </div>
              ))}
              </>
            )}
            </div>
          )}
        </>
      )}

      {/* Trending Section for Recently Viewed */}
      {activeTab === 'recentlyViewed' && trending.length > 0 && !searchQuery && (
        <div className="glass-panel hover-lift stagger-fade-in" style={{ marginTop: 'var(--space-8)', padding: 'var(--space-5) var(--space-5) var(--space-6)', animationDelay: '0.2s' }}>
          <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>Trending Now</h2>
          <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>The Top Eight Products Researchers Have Ordered In The Last Sixty Days.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
            {trending.map((t, idx) => {
              const inner = (
                <div key={idx} style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', position: 'relative' }}>
                    <div style={{ height: 100, background: 'radial-gradient(circle at 50% 50%, rgba(192,184,168,0.10) 0%, var(--black) 100%)', borderRadius: 8, marginBottom: 12, position: 'relative' }}>
                    <Image src={t.image_url || getProductImage(null, t.category || 'Other', t.name)} alt={t.name} fill unoptimized style={{ objectFit: 'contain', padding: 8 }} />
                    </div>
                    <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.95rem' }}>{t.name}</div>  
                </div>
              );
              return storefrontSlug ? (
                <Link key={t.product_id} href={`/${storefrontSlug}?product=${encodeURIComponent(t.product_id)}`} style={{ textDecoration: 'none' }}>
                  {inner}
                </Link>
              ) : (
                <div key={t.product_id}>{inner}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination: Load More */}
      {visibleCount < currentItems.length && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
          <button 
            onClick={() => setVisibleCount(v => v + 24)} 
            className="btn btn-secondary"
            style={{ padding: '12px 32px', borderRadius: 30, background: 'rgba(255,255,255,0.05)' }}
          >
            Load More ({currentItems.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,20,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,196,188,0.3)', padding: '12px 24px', borderRadius: 40, zIndex: 100, display: 'flex', alignItems: 'center', gap: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ color: 'var(--white)', fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedItems.size} Selected</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(selectedItems.size >= 2 && selectedItems.size <= 4) && (
              <button onClick={() => { setIsComparing(true); saveComparison(Array.from(selectedItems)); }} className="btn btn-secondary" style={{ borderRadius: 20, padding: '8px 20px', background: 'rgba(0,196,188,0.1)', color: 'var(--teal)', border: '1px solid rgba(0,196,188,0.2)' }}>Compare</button>
            )}
            <DynamicAddToCartButton
              onClick={handleBulkAdd}
              isSmall={true}
            />
            <button onClick={() => setSelectedItems(new Set())} className="btn btn-ghost" style={{ borderRadius: 20, color: 'var(--silver)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }} onClick={() => setQuickViewItem(null)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 800, padding: 0, borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setQuickViewItem(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'var(--white)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}><X size={16} /></button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div style={{ flex: '0 0 300px', background: 'radial-gradient(circle at 50% 50%, rgba(192,184,168,0.10) 0%, var(--black) 100%)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', position: 'relative' }}>
                <Image src={quickViewItem.image_url || getProductImage(null, quickViewItem.category || 'Other', quickViewItem.name)} fill unoptimized style={{ objectFit: 'contain' }} alt={quickViewItem.name} />
              </div>
              <div style={{ flex: 1, padding: 'var(--space-6)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: 'var(--teal)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', marginBottom: 8 }}>{quickViewItem.category || 'Compound'}</div>
                <h2 style={{ color: 'var(--white)', fontSize: '1.8rem', lineHeight: 1.2, marginBottom: 16 }}>{quickViewItem.name}</h2>
                <div style={{ color: 'var(--silver)', fontSize: '0.95rem', marginBottom: 24, flex: 1 }}>
                  This item is saved in your Lab Journal. It is {quickViewItem.in_stock === false ? 'currently out of stock' : 'in stock and ready to ship'}.
                  {quickViewItem.unit_size && <div><br/><strong>Unit Size:</strong> {quickViewItem.unit_size}{quickViewItem.unit_measure}</div>}
                </div>
                <div style={{ paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: 'var(--teal)', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-brand)' }}>
                    ${(quickViewItem.retail_price ?? quickViewItem.base_cost ?? 0).toFixed(2)}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {activeTab === 'favorites' && (
                      <button onClick={() => { removeItem(quickViewItem.product_id); setQuickViewItem(null); }} className="btn btn-ghost" style={{ color: 'var(--red)' }}><Trash2 size={16}/> Remove</button>
                    )}
                    {storefrontSlug && (
                      <Link href={`/${storefrontSlug}?product=${encodeURIComponent(quickViewItem.product_id)}`} className="btn btn-secondary">View Product</Link>
                    )}
                    {storefrontSlug && (
                      <DynamicAddToCartButton
                        onClick={() => { handleQuickAdd(quickViewItem); setQuickViewItem(null); }}
                        disabled={quickViewItem.in_stock === false}
                        isSmall={true}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {isComparing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }} onClick={() => setIsComparing(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 1000, padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsComparing(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--white)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}><X size={16} /></button>
            <h2 style={{ color: 'var(--white)', fontSize: '1.4rem', marginBottom: 'var(--space-6)' }}>Comparing {selectedItems.size} Compounds</h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedItems.size}, 1fr)`, gap: 'var(--space-4)', overflowY: 'auto' }}>
              {Array.from(selectedItems).map(id => {
                const item = [...favorites, ...pastOrders, ...recentlyViewed].find(i => i.product_id === id);
                if (!item) return null;
                const displayPrice = item.retail_price ?? item.base_cost ?? 0;
                return (
                  <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'rgba(255,255,255,0.03)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ width: '100%', height: 120, background: 'var(--black-2)', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <Image src={item.image_url || getProductImage(null, item.category || 'Other', item.name)} fill unoptimized style={{ objectFit: 'contain', padding: 8 }} alt={item.name} />
                    </div>
                    <div style={{ color: 'var(--teal)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.category || 'N/A'}</div>
                    <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1.1rem' }}>{item.name}</div>
                    <div style={{ color: 'var(--silver)', fontSize: '0.9rem', paddingTop: 12, marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Price:</span> <strong style={{ color: 'var(--teal)' }}>${displayPrice.toFixed(2)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Size:</span> <strong style={{ color: 'var(--white)' }}>{item.unit_size}{item.unit_measure}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Status:</span> <strong style={{ color: item.in_stock === false ? 'var(--red)' : 'var(--teal)' }}>{item.in_stock === false ? 'Out of Stock' : 'In Stock'}</strong></div>
                    </div>
                    {storefrontSlug && (
                      <DynamicAddToCartButton
                        onClick={() => { handleQuickAdd(item); setSelectedItems(s => { const ns = new Set(s); ns.delete(item.product_id); return ns; }); if (selectedItems.size <= 2) setIsComparing(false); }}
                        disabled={item.in_stock === false}
                        isSmall={true}
                        style={{ marginTop: 12 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {intelligenceCompound && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setIntelligenceCompound(null)}>
          <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-card)', height: '100%', borderLeft: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()} className="slide-in-right">
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--teal)' }}><FlaskConical size={20}/> Intelligence</h2>
              <button onClick={() => setIntelligenceCompound(null)} className="btn btn-ghost btn-sm"><X size={20}/></button>
            </div>
            <div style={{ padding: 'var(--space-6)' }}>
              <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>{intelligenceCompound}</h1>
              
              {!intelligenceData ? (
                <p style={{ color: 'var(--silver)' }}>Loading intelligence data...</p>
              ) : intelligenceData.loading ? (
                <p style={{ color: 'var(--silver)' }}>Analyzing compound...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  {intelligenceData.evidence_tier && (
                    <div>
                      <span style={{ background: intelligenceData.evidence_tier === 'FDA Approved' ? 'var(--teal)' : 'rgba(255,255,255,0.1)', color: intelligenceData.evidence_tier === 'FDA Approved' ? '#000' : 'var(--white)', padding: '4px 12px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 'bold' }}>
                        Tier: {intelligenceData.evidence_tier}
                      </span>
                    </div>
                  )}
                  
                  <p style={{ color: 'var(--silver)', lineHeight: 1.6 }}>{intelligenceData.description}</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="glass-panel" style={{ padding: 'var(--space-3)', borderRadius: 8 }}>
                      <p style={{ margin: 0, color: 'var(--silver)', fontSize: '0.8rem', marginBottom: 4 }}>Half-Life</p>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>{intelligenceData.half_life || 'Unknown'}</p>
                    </div>
                    <div className="glass-panel" style={{ padding: 'var(--space-3)', borderRadius: 8 }}>
                      <p style={{ margin: 0, color: 'var(--silver)', fontSize: '0.8rem', marginBottom: 4 }}>Clinical Dosage</p>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>{intelligenceData.clinical_dosage || 'Unknown'}</p>
                    </div>
                  </div>

                  {intelligenceData.warnings && (
                    <div style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', padding: 'var(--space-4)', borderRadius: 8 }}>
                      <p style={{ margin: 0, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold', marginBottom: 8 }}><Info size={16}/> Warnings & Interactions</p>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', lineHeight: 1.5 }}>{intelligenceData.warnings}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalProduct && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setQrModalProduct(null)} />
          <div className="glass-panel" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 350, borderRadius: 'var(--radius-xl)', overflow: 'hidden', padding: 'var(--space-6)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, color: 'var(--white)' }}>Vial Label (QR)</h3>
              <button onClick={() => setQrModalProduct(null)} className="btn btn-ghost btn-sm" style={{ padding: 4 }}><X size={20} /></button>
            </div>
            
            {(() => {
              const item = [...catalog, ...favorites, ...pastOrders, ...recentlyViewed, ...bundles].find(i => i.product_id === qrModalProduct);
              const inv = inventoryData[qrModalProduct];
              if (!item || !inv) return null;
              
              const qrText = encodeURIComponent(`Product: ${item.name}\nMg: ${inv.recon_mg}\nMl: ${inv.recon_ml}\nDose: ${inv.recon_dose}mcg`);
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrText}&format=svg&color=00c4bc&bgcolor=14232f`;
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div style={{ background: '#fff', padding: 8, borderRadius: 8, display: 'inline-block' }}>
                    <Image src={qrUrl} alt="QR Code" width={200} height={200} unoptimized />
                  </div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--teal)', fontWeight: 'bold', marginBottom: 4 }}>{item.name}</div>
                    <div>{inv.recon_mg}mg • {inv.recon_ml}ml BAC</div>
                    <div>Desired Dose: {inv.recon_dose}mcg</div>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-4)' }} onClick={() => window.print()}>Print Label</button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style dangerouslySetInnerHTML={{__html: `
        .slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @media (max-width: 820px) {
          .dose-grid { grid-template-columns: 1fr !important; }
        }
      `}} />
      </div>
    </div>
  );
}
