'use client';

/**
 * R35 Phase 3 & 4 — Compare drawer for agent storefronts.
 *
 * Fixed, bottom-anchored drawer that lets a researcher pin up to 3 products
 * from the modal's "Pin To Compare" button and view them side by side.
 *
 * Includes a full-screen StorefrontCompareModal that renders the attributes matrix.
 */

import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Scale, ChevronDown, ChevronRight, GripHorizontal, ChevronLeft } from 'lucide-react';
import { evidenceTier, type Compound, RISK_META, researchAreaLabel, wadaLabel } from '@/lib/compounds';
import InCellGlossaryTooltip from '../research/InCellGlossaryTooltip';
import AttributeRadarChart from '../research/AttributeRadarChart';

interface PinnedItem {
  productName: string;
  imageUrl: string | null;
  pricePerVialDollars: number | null;
  compoundSlug: string | null;
  evidenceTierKey: string | null;
  pinnedAt: number;
}

const STORAGE_KEY = 'pnl:compare';
const MAX_PINNED = 4; // bumped to 4

function readPinned(): PinnedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || '[]';
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.slice(-MAX_PINNED);
  } catch {
    return [];
  }
}

function writePinned(list: PinnedItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_PINNED)));
  } catch {
    // localStorage may be unavailable; ignore.
  }
}

function dispatchAddToCart(productName: string) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('pnl:add-to-cart-by-name', {
      detail: { name: productName },
    }));
  } catch {
    // ignore
  }
}

function dispatchAddAllToCart(items: PinnedItem[]) {
  for (const item of items) {
    dispatchAddToCart(item.productName);
  }
}

const cellStyle: React.CSSProperties = {
  padding: 'var(--space-3, 12px)',
  borderBottom: '1px solid rgba(168,180,192,0.18)',
  verticalAlign: 'top',
  fontSize: '0.88rem',
  color: 'var(--white, #FFFFFF)',
};

const labelCellStyle: React.CSSProperties = {
  ...cellStyle,
  color: 'var(--silver, #A8B4C0)',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  position: 'sticky',
  left: 0,
  zIndex: 10,
  boxShadow: 'inset -1px 0 0 rgba(168,180,192,0.18)',
};

const groupCellStyle: React.CSSProperties = {
  padding: 'var(--space-3, 12px)',
  background: 'linear-gradient(rgba(192,197,206,0.1), rgba(192,197,206,0.1)), #0F161E',
  borderTop: '1px solid rgba(192,197,206,0.3)',
  borderBottom: '1px solid rgba(192,197,206,0.3)',
  color: 'var(--teal, #C0C5CE)',
  fontWeight: 800,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  userSelect: 'none',
};

const NL = 'Not Listed';
function txt(v: unknown): string {
  const s = (v ?? '').toString().trim();
  return s || NL;
}

function parseHalfLifeHours(hl: string | null | undefined): number {
  if (!hl) return 0;
  const s = hl.toLowerCase();
  const match = s.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (s.includes('min')) return num / 60;
  if (s.includes('day')) return num * 24;
  if (s.includes('week')) return num * 24 * 7;
  return num; // assume hours by default
}

const KNOWN_SYNERGIES = [
  { pairs: ['bpc-157', 'tb-500'], message: 'Synergy Detected: BPC-157 and TB-500 act highly synergistically for combined systemic and localized tissue/tendon repair.' },
  { pairs: ['cjc-1295-without-dac', 'ipamorelin'], message: 'Synergy Detected: CJC-1295 + Ipamorelin stack amplifies GH pulse amplitude without spiking cortisol or prolactin.' },
  { pairs: ['tirzepatide', 'retatrutide'], message: 'Warning: Compounding GLP-1/GIP agonists may lead to severe gastrointestinal distress.' }
];

export default function StorefrontCompareDrawer({ 
  primaryColor,
  compoundsBySlug = {}
}: { 
  primaryColor: string;
  compoundsBySlug?: Record<string, Compound>;
}) {
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  
  // Accordion State
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Mobile View UX
  const [mobileViewIndex, setMobileViewIndex] = useState<number>(1);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setPinned(readPinned());

    const onAdd = (e: Event) => {
      const detail = (e as CustomEvent<PinnedItem>).detail;
      if (!detail || !detail.productName) return;
      setPinned((prev) => {
        const filtered = prev.filter((p) => p.productName !== detail.productName);
        const next = [...filtered, detail].slice(-MAX_PINNED);
        writePinned(next);
        return next;
      });
      setCollapsed(false);
    };

    const onRemove = (e: Event) => {
      const detail = (e as CustomEvent<{ productName: string }>).detail;
      if (!detail || !detail.productName) return;
      setPinned((prev) => {
        const next = prev.filter((p) => p.productName !== detail.productName);
        writePinned(next);
        return next;
      });
    };

    const onClear = () => {
      setPinned([]);
      writePinned([]);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPinned(readPinned());
    };

    window.addEventListener('pnl:compare-add', onAdd as EventListener);
    window.addEventListener('pnl:compare-remove', onRemove as EventListener);
    window.addEventListener('pnl:compare-clear', onClear as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pnl:compare-add', onAdd as EventListener);
      window.removeEventListener('pnl:compare-remove', onRemove as EventListener);
      window.removeEventListener('pnl:compare-clear', onClear as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function removeAt(i: number) {
    setPinned((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      writePinned(next);
      return next;
    });
  }

  function clearAll() {
    setPinned([]);
    writePinned([]);
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;
    
    setPinned(prev => {
      const next = [...prev];
      const [removed] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, removed);
      writePinned(next);
      return next;
    });
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });
  };

  type RowDef =
    | { kind: 'group'; label: string }
    | { 
        kind: 'data'; 
        label: string; 
        glossaryTerm?: string;
        bestLogic?: 'max' | 'min';
        getRawScore?: (p: PinnedItem) => number;
        getValue: (p: PinnedItem) => unknown; 
        render: (p: PinnedItem, maxHalfLife?: number) => React.ReactNode 
      };

  const ROWS: RowDef[] = useMemo(() => {
    return [
      { kind: 'group', label: 'Commercial' },
      {
        kind: 'data', label: 'Price Per Vial',
        bestLogic: 'min',
        getRawScore: (p) => p.pricePerVialDollars ?? Infinity,
        getValue: (p) => p.pricePerVialDollars ?? Infinity,
        render: (p) => p.pricePerVialDollars != null ? <span style={{ color: primaryColor, fontWeight: 800 }}>${Number(p.pricePerVialDollars).toFixed(2)}</span> : NL
      },
      { kind: 'group', label: 'Evidence & Risk' },
      {
        kind: 'data', label: 'Evidence Tier', glossaryTerm: 'Evidence Tier',
        bestLogic: 'max',
        getRawScore: (p) => {
          if (p.evidenceTierKey === 'approved_drug') return 5;
          if (p.evidenceTierKey === 'investigational') return 4;
          if (p.evidenceTierKey === 'preclinical') return 3;
          if (p.evidenceTierKey === 'research_chemical') return 2;
          return 1;
        },
        getValue: (p: PinnedItem) => p.evidenceTierKey || NL,
        render: (p: PinnedItem) => {
          const tier = p.evidenceTierKey ? evidenceTier(p.evidenceTierKey) : null;
          return tier ? (
            <span style={{ color: tier.color, fontWeight: 700, border: `1px solid ${tier.color}`, padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem' }}>
              {tier.label}
            </span>
          ) : NL;
        }
      },
      {
        kind: 'data', label: 'Risk Level',
        bestLogic: 'min',
        getRawScore: (p) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          if (c?.risk_level === 'low') return 1;
          if (c?.risk_level === 'moderate') return 2;
          if (c?.risk_level === 'high') return 3;
          if (c?.risk_level === 'critical') return 4;
          return 5;
        },
        getValue: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return c?.risk_level || NL;
        },
        render: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          const r = c?.risk_level ? RISK_META[c.risk_level] : null;
          return r ? <span style={{ color: r.color, fontWeight: 700 }}>{r.label}</span> : NL;
        }
      },
      {
        kind: 'data', label: 'WADA Status',
        getValue: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return c?.wada_status || NL;
        },
        render: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return c?.wada_status ? wadaLabel(c.wada_status) : NL;
        }
      },
      { kind: 'group', label: 'Pharmacology' },
      {
        kind: 'data', label: 'Half-Life', glossaryTerm: 'Half-Life',
        bestLogic: 'max',
        getRawScore: (p) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return parseHalfLifeHours(c?.half_life);
        },
        getValue: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return c?.half_life || NL;
        },
        render: (p: PinnedItem, maxHalfLife?: number) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          if (!c?.half_life) return NL;
          const hlVal = parseHalfLifeHours(c.half_life);
          const pct = maxHalfLife && maxHalfLife > 0 ? (hlVal / maxHalfLife) * 100 : 0;
          return (
            <div>
              <div style={{ color: primaryColor, fontWeight: 700, marginBottom: 4 }}>{c.half_life}</div>
              {pct > 0 && (
                <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', width: '100%', maxWidth: 150 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: primaryColor }} />
                </div>
              )}
            </div>
          );
        }
      },
      {
        kind: 'data', label: 'Molecular Target',
        getValue: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return txt(c?.molecular_target);
        },
        render: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return txt(c?.molecular_target);
        }
      },
      {
        kind: 'data', label: 'Research Areas',
        getValue: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return c?.research_areas?.length ? c.research_areas.join(',') : NL;
        },
        render: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return c?.research_areas?.length ? c.research_areas.map(researchAreaLabel).join(', ') : NL;
        }
      },
      {
        kind: 'data', label: 'Reported Findings',
        getValue: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return txt(c?.benefits);
        },
        render: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return txt(c?.benefits);
        }
      },
      { kind: 'group', label: 'Handling' },
      {
        kind: 'data', label: 'Storage Temp', glossaryTerm: 'Storage',
        getValue: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return txt(c?.handling?.storage_temp);
        },
        render: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return txt(c?.handling?.storage_temp);
        }
      },
      {
        kind: 'data', label: 'Reconstituted Shelf Life',
        bestLogic: 'max',
        getRawScore: (p) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days ?? 0;
        },
        getValue: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          const d = c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days;
          return d != null ? `${d} Days Refrigerated` : NL;
        },
        render: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          const d = c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days;
          return d != null ? `${d} Days Refrigerated` : NL;
        }
      }
    ];
  }, [compoundsBySlug, primaryColor]);

  if (!mounted) return null;
  if (pinned.length === 0) return null;
  if (typeof document === 'undefined') return null;

  let clampedMobileIndex = mobileViewIndex;
  if (clampedMobileIndex >= pinned.length && pinned.length > 1) {
    clampedMobileIndex = pinned.length - 1;
  }

  const displayedPinned = isMobile && pinned.length > 1 
    ? [pinned[0], pinned[clampedMobileIndex]] 
    : pinned;

  const activeSynergies = KNOWN_SYNERGIES.filter(syn => 
    syn.pairs.every(slug => pinned.some(p => p.compoundSlug === slug))
  );

  const maxHalfLife = useMemo(() => {
    return Math.max(...displayedPinned.map(p => {
      const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
      return parseHalfLifeHours(c?.half_life);
    }), 0);
  }, [displayedPinned, compoundsBySlug]);

  const maxCitations = useMemo(() => {
    return Math.max(...displayedPinned.map(p => {
      const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
      return c?.pubmed_citation_count || 0;
    }), 0);
  }, [displayedPinned, compoundsBySlug]);

  const smartSummary = useMemo(() => {
    if (pinned.length !== 2) return null;
    const [a, b] = pinned;
    const cA = a.compoundSlug ? compoundsBySlug[a.compoundSlug] : null;
    const cB = b.compoundSlug ? compoundsBySlug[b.compoundSlug] : null;
    if (!cA || !cB) return null;

    const aHl = parseHalfLifeHours(cA.half_life);
    const bHl = parseHalfLifeHours(cB.half_life);
    let hlText = '';
    if (aHl && bHl) {
      if (aHl > bHl) hlText = `${a.productName} has a ${(aHl/bHl).toFixed(1)}x longer half-life than ${b.productName}.`;
      else if (bHl > aHl) hlText = `${b.productName} has a ${(bHl/aHl).toFixed(1)}x longer half-life than ${a.productName}.`;
    }
    return hlText;
  }, [pinned, compoundsBySlug]);

  const colors = [primaryColor, '#F6AD55', '#68D391', '#FC8181'];

  const radarData = useMemo(() => {
    if (pinned.length < 2) return [];
    return [
      {
        label: 'Safety Profile',
        scores: pinned.map(p => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          if (c?.risk_level === 'low') return 90;
          if (c?.risk_level === 'moderate') return 70;
          if (c?.risk_level === 'high') return 40;
          if (c?.risk_level === 'critical') return 10;
          return 50;
        })
      },
      {
        label: 'Evidence Level',
        scores: pinned.map(p => {
          if (p.evidenceTierKey === 'approved_drug') return 100;
          if (p.evidenceTierKey === 'investigational') return 80;
          if (p.evidenceTierKey === 'preclinical') return 60;
          if (p.evidenceTierKey === 'research_chemical') return 40;
          return 20;
        })
      },
      {
        label: 'Citations',
        scores: pinned.map(p => {
          if (!maxCitations) return 10;
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          const count = c?.pubmed_citation_count || 0;
          return Math.min(100, Math.max(10, (count / maxCitations) * 100));
        })
      },
      { 
        label: 'Half-Life', 
        scores: pinned.map(p => {
          if (!maxHalfLife) return 20;
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return Math.min(100, Math.max(10, (parseHalfLifeHours(c?.half_life) / maxHalfLife) * 100));
        })
      }
    ];
  }, [pinned, compoundsBySlug, maxCitations, maxHalfLife]);

  return createPortal(
    <>
      <div
        role="region"
        aria-label="Compare Pinned Products"
        style={{
          position: 'fixed',
          left: 0, right: 0,
          bottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 99000,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            margin: '0 auto',
            maxWidth: 980,
            pointerEvents: 'auto',
            background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)',
            border: `2px solid ${primaryColor}55`,
            borderBottom: 'none',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -10px 32px rgba(0,0,0,0.55)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            background: `linear-gradient(90deg, ${primaryColor}25, transparent)`,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexWrap: 'wrap',
          }}>
            <div style={{
              color: primaryColor, fontWeight: 800, fontSize: '0.86rem',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              flex: 1, minWidth: 150,
            }}>
              Compare ({pinned.length} Of {MAX_PINNED})
            </div>
            {pinned.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowMatrix(true)}
                style={{
                  background: primaryColor, border: `1px solid ${primaryColor}`,
                  color: '#04221F', borderRadius: 8, padding: '6px 16px',
                  fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                  boxShadow: `0 2px 8px ${primaryColor}55`,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Scale size={14} />
                Compare Attributes
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--white)', borderRadius: 8, padding: '6px 12px',
                fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
            <button
              type="button"
              onClick={() => dispatchAddAllToCart(pinned)}
              aria-label="Add All Pinned To Cart - Stack Builder"
              style={{
                background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.12)`,
                color: 'var(--white)', borderRadius: 8, padding: '6px 12px',
                fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer',
              }}
            >
              Add All To Cart
            </button>
            <button
              type="button"
              onClick={clearAll}
              aria-label="Clear All Pinned"
              style={{
                background: 'rgba(229,62,62,0.10)', border: '1px solid rgba(229,62,62,0.32)',
                color: '#F08A8A', borderRadius: 8, padding: '6px 12px',
                fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Clear All
            </button>
          </div>

          {!collapsed && (
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: 10 }}>
              {pinned.map((item, i) => {
                const tier = item.evidenceTierKey ? evidenceTier(item.evidenceTierKey) : null;
                const c = item.compoundSlug ? compoundsBySlug[item.compoundSlug] : null;
                return (
                  <div
                    key={item.productName}
                    style={{
                      position: 'relative',
                      padding: 10, borderRadius: 12,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      display: 'flex', flexDirection: 'column', gap: 8,
                      minHeight: 130,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      aria-label={`Remove ${item.productName} From Compare`}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 24, height: 24, minWidth: 24, minHeight: 24,
                        borderRadius: '50%', padding: 0,
                        background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)',
                        color: 'var(--white)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          width={36}
                          height={36}
                          style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: '#0F1923' }}
                        />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${primaryColor}25` }} aria-hidden="true" />
                      )}
                      <div style={{
                        flex: 1, color: 'var(--white)', fontWeight: 800,
                        fontSize: '0.82rem', lineHeight: 1.2, paddingRight: 22,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.productName}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {tier && (
                        <span style={{
                          fontSize: '0.64rem', padding: '3px 8px', borderRadius: 9999,
                          background: `${tier.color}1A`, color: tier.color, fontWeight: 800,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          border: `1px solid ${tier.color}55`,
                        }}>{tier.label}</span>
                      )}
                      {c?.wada_status !== 'Permitted' && (
                        <span style={{ background: 'rgba(229,62,62,0.15)', color: '#FC8181', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>
                          WADA 🚫
                        </span>
                      )}
                      {item.pricePerVialDollars != null && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: primaryColor, fontFamily: 'var(--font-brand)' }}>
                          ${Number(item.pricePerVialDollars).toFixed(2)}/Vial
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full-Screen Comparison Modal */}
      {showMatrix && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4, 16px)'
        }}>
          <div style={{
            background: '#0F161E',
            border: `1px solid ${primaryColor}40`,
            borderRadius: 'var(--radius-xl, 16px)',
            width: '100%', maxWidth: 1200,
            maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: `linear-gradient(90deg, ${primaryColor}15, transparent)`,
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--white)' }}>
                Compare Products
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                {pinned.length >= 2 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--silver)', fontSize: '0.85rem', fontWeight: 800, userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={diffMode} 
                      onChange={(e) => setDiffMode(e.target.checked)} 
                      style={{ accentColor: primaryColor, width: 16, height: 16 }}
                    />
                    Highlight Differences
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => dispatchAddAllToCart(pinned)}
                  style={{
                    background: primaryColor, border: 'none', color: '#04221F',
                    padding: '8px 16px', borderRadius: 8, fontWeight: 800, fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Add All To Cart
                </button>
                <button
                  onClick={() => setShowMatrix(false)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--white)',
                    width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {activeSynergies.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {activeSynergies.map((syn, idx) => (
                    <div key={idx} style={{ background: 'rgba(104,211,145,0.1)', border: '1px solid rgba(104,211,145,0.3)', color: '#68D391', padding: '12px 16px', borderRadius: 8, marginBottom: 8, fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🔥</span> {syn.message}
                    </div>
                  ))}
                </div>
              )}

              {smartSummary && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: '0.9rem', fontWeight: 600, color: 'var(--silver)' }}>
                  <span style={{ color: primaryColor }}>Smart Summary:</span> {smartSummary}
                </div>
              )}

              {pinned.length > 2 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-lg, 12px)', padding: 'var(--space-4, 16px)', marginBottom: 24, overflow: 'hidden' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--white)', textAlign: 'center', fontWeight: 800 }}>
                    Profile Comparison
                  </h3>
                  <AttributeRadarChart data={radarData} colors={colors} size={280} />
                </div>
              )}

              <div style={{ borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', position: 'relative' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                    <tr>
                      <th style={{ ...labelCellStyle, textAlign: 'left', width: '20%', background: '#0F161E', zIndex: 30 }} scope="col">Product</th>
                      {displayedPinned.map((p) => {
                        const originalIndex = pinned.findIndex(x => x.productName === p.productName);

                        return (
                          <th 
                            key={p.productName} 
                            style={{ ...cellStyle, textAlign: 'left', width: `${80 / displayedPinned.length}%`, background: '#0F161E' }} 
                            scope="col"
                            draggable={!isMobile}
                            onDragStart={(e) => handleDragStart(e, originalIndex)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, originalIndex)}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {!isMobile && <GripHorizontal size={14} color="rgba(255,255,255,0.2)" style={{ cursor: 'grab' }} />}
                                
                                {isMobile && originalIndex !== 0 && pinned.length > 2 && (
                                  <button
                                    onClick={() => setMobileViewIndex(prev => prev > 1 ? prev - 1 : pinned.length - 1)}
                                    style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}
                                  >
                                    <ChevronLeft size={18} />
                                  </button>
                                )}

                                {p.imageUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.imageUrl} alt={p.productName} width={48} height={48} style={{ borderRadius: 8, objectFit: 'cover' }} />
                                )}
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: primaryColor }}>{p.productName}</div>
                                
                                {isMobile && originalIndex !== 0 && pinned.length > 2 && (
                                  <button
                                    onClick={() => setMobileViewIndex(prev => prev < pinned.length - 1 ? prev + 1 : 1)}
                                    style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}
                                  >
                                    <ChevronRight size={18} />
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => dispatchAddToCart(p.productName)}
                                style={{
                                  background: primaryColor, border: 'none', color: '#04221F',
                                  padding: '8px 12px', borderRadius: 8, fontWeight: 800, fontSize: '0.8rem',
                                  cursor: 'pointer', marginTop: 4, width: 'fit-content'
                                }}
                              >
                                Add To Cart
                              </button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row, rIdx) => {
                      if (row.kind === 'group') {
                        const isCollapsed = collapsedGroups.has(row.label);
                        return (
                          <tr key={rIdx} onClick={() => toggleGroup(row.label)}>
                            <td style={{ ...groupCellStyle, position: 'sticky', left: 0, zIndex: 10 }} colSpan={displayedPinned.length + 1}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                {row.label}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      // Check collapsed state for parent group
                      let currentGroupLabel = '';
                      for (let i = rIdx; i >= 0; i--) {
                        if (ROWS[i].kind === 'group') {
                          currentGroupLabel = ROWS[i].label;
                          break;
                        }
                      }

                      if (collapsedGroups.has(currentGroupLabel)) {
                        return null;
                      }

                      // Check differences
                      const values = displayedPinned.map(p => row.getValue(p));
                      const allSame = values.every(v => v === values[0]);
                      const isDiff = !allSame && displayedPinned.length > 1;

                      const trStyle: React.CSSProperties = { transition: 'background 0.2s' };
                      const tdLabelStyle: React.CSSProperties = { ...labelCellStyle, background: '#0F161E', transition: 'color 0.2s' };
                      const valueCellStyle: React.CSSProperties = { ...cellStyle, transition: 'opacity 0.2s' };

                      if (diffMode) {
                        if (isDiff) {
                          trStyle.background = `${primaryColor}15`;
                          tdLabelStyle.background = `linear-gradient(${primaryColor}15, ${primaryColor}15), #0F161E`;
                        } else {
                          tdLabelStyle.color = 'rgba(168,180,192,0.3)';
                          valueCellStyle.opacity = 0.3;
                        }
                      }

                      // Winner Engine Calculation
                      const bestIndices: number[] = [];
                      if (row.bestLogic && displayedPinned.length > 1 && !allSame) {
                        const scores = displayedPinned.map(p => row.getRawScore ? row.getRawScore(p) : 0);
                        const validScores = scores.filter(s => typeof s === 'number' && !isNaN(s) && s !== Infinity);
                        if (validScores.length > 0) {
                          const bestValue = row.bestLogic === 'max' ? Math.max(...validScores) : Math.min(...validScores);
                          scores.forEach((s, idx) => {
                            if (s === bestValue) bestIndices.push(idx);
                          });
                        }
                      }

                      return (
                        <tr key={rIdx} style={trStyle}>
                          <td style={tdLabelStyle}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {row.label}
                              {row.glossaryTerm && <InCellGlossaryTooltip term={row.glossaryTerm} />}
                            </div>
                          </td>
                          {displayedPinned.map((p, pIdx) => {
                            const isWinner = bestIndices.includes(pIdx);
                            return (
                              <td key={p.productName} style={{ ...valueCellStyle, position: 'relative' }}>
                                {isWinner && (
                                  <div style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.65rem', background: primaryColor, color: '#04221F', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                                    TOP PICK 👑
                                  </div>
                                )}
                                <div style={isWinner ? { borderLeft: `2px solid ${primaryColor}`, paddingLeft: 8, marginLeft: -10 } : {}}>
                                  {row.render(p, maxHalfLife)}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
