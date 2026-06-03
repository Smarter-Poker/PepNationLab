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
import { X, Scale } from 'lucide-react';
import { evidenceTier, type Compound, RISK_META, researchAreaLabel, wadaLabel } from '@/lib/compounds';

interface PinnedItem {
  productName: string;
  imageUrl: string | null;
  pricePerVialDollars: number | null;
  compoundSlug: string | null;
  evidenceTierKey: string | null;
  pinnedAt: number;
}

const STORAGE_KEY = 'pnl:compare';
const MAX_PINNED = 3;

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
  background: 'rgba(0,196,188,0.08)',
  borderTop: '1px solid rgba(0,196,188,0.3)',
  borderBottom: '1px solid rgba(0,196,188,0.3)',
  color: 'var(--teal, #00C4BC)',
  fontWeight: 800,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const NL = 'Not Listed';
function txt(v: unknown): string {
  const s = (v ?? '').toString().trim();
  return s || NL;
}

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

  useEffect(() => {
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

  const ROWS = useMemo(() => {
    return [
      { kind: 'group', label: 'Evidence & Risk' },
      {
        kind: 'data', label: 'Evidence Tier',
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
        kind: 'data', label: 'Half-Life',
        getValue: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return c?.half_life || NL;
        },
        render: (p: PinnedItem) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          return c?.half_life ? <span style={{ color: primaryColor, fontWeight: 700 }}>{c.half_life}</span> : NL;
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
        kind: 'data', label: 'Storage Temp',
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
          }}>
            <div style={{
              color: primaryColor, fontWeight: 800, fontSize: '0.86rem',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              flex: 1,
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
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: `repeat(${pinned.length}, 1fr)`, gap: 10 }}>
              {pinned.map((item, i) => {
                const tier = item.evidenceTierKey ? evidenceTier(item.evidenceTierKey) : null;
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
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--white)' }}>
                Compare Products
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
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
              <div style={{ borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', position: 'relative' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                    <tr>
                      <th style={{ ...labelCellStyle, textAlign: 'left', width: '20%', background: '#0F161E', zIndex: 30 }} scope="col">Product</th>
                      {pinned.map((p) => (
                        <th key={p.productName} style={{ ...cellStyle, textAlign: 'left', width: `${80 / pinned.length}%`, background: '#0F161E' }} scope="col">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {p.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={p.productName} width={48} height={48} style={{ borderRadius: 8, objectFit: 'cover' }} />
                              )}
                              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: primaryColor }}>{p.productName}</div>
                            </div>
                            {p.pricePerVialDollars != null && (
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--white)' }}>
                                ${Number(p.pricePerVialDollars).toFixed(2)}/Vial
                              </div>
                            )}
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
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row, rIdx) => {
                      if (row.kind === 'group') {
                        return (
                          <tr key={rIdx}>
                            <td style={{ ...groupCellStyle, position: 'sticky', left: 0, zIndex: 10, background: 'rgba(0,196,188,0.1)' }} colSpan={pinned.length + 1}>
                              {row.label}
                            </td>
                          </tr>
                        );
                      }

                      // Check differences
                      const values = pinned.map(p => row.getValue!(p));
                      const allSame = values.every(v => v === values[0]);
                      const isDiff = !allSame && pinned.length > 1;

                      let trStyle: React.CSSProperties = { transition: 'opacity 0.2s, background 0.2s' };
                      let tdLabelStyle: React.CSSProperties = { ...labelCellStyle, background: '#0F161E' };

                      if (diffMode) {
                        if (isDiff) {
                          trStyle.background = `${primaryColor}15`;
                          tdLabelStyle.background = `rgba(0,0,0,0)`;
                        } else {
                          trStyle.opacity = 0.3;
                        }
                      }

                      return (
                        <tr key={rIdx} style={trStyle}>
                          <td style={tdLabelStyle}>{row.label}</td>
                          {pinned.map((p, pIdx) => (
                            <td key={pIdx} style={cellStyle}>
                              {row.render!(p)}
                            </td>
                          ))}
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
