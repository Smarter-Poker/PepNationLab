'use client';

import React from 'react';
import Link from 'next/link';
import { X, Sparkles, ShoppingCart } from 'lucide-react';
import type { MatchedProduct } from '../storefront/discovery-shared';
import type { MatchResult } from '@/lib/match-engine';

export interface CompareItem {
  slug: string;
  displayName: string;
  score?: number | null;
  evidenceTier: string | null;
  riskLevel: string;
  halfLife?: string | null;
  molecularWeight?: number | null;
  isTempSensitive?: boolean;
  
  // Storefront specific
  product_id?: string;
  price_cents?: number;
}

export function mapToCompareItem(r: MatchResult | MatchedProduct): CompareItem {
  if ('compound_slug' in r) {
    return {
      slug: r.compound_slug || '',
      displayName: r.display_name,
      score: r.score,
      evidenceTier: r.evidence_tier,
      riskLevel: r.riskLevel || 'any',
      halfLife: r.halfLife,
      molecularWeight: r.molecularWeight,
      isTempSensitive: false,
      product_id: r.product_id,
      price_cents: r.price_cents,
    };
  } else {
    return {
      slug: r.slug,
      displayName: r.displayName,
      score: r.score,
      evidenceTier: r.evidenceTier,
      riskLevel: r.riskLevel,
      halfLife: r.halfLife,
      molecularWeight: r.molecularWeight,
      isTempSensitive: r.isTempSensitive,
    };
  }
}

function tierLabel(tier: string | null): string {
  if (!tier) return 'Unknown';
  switch (tier) {
    case 'approved_drug': return 'Approved Drug';
    case 'investigational': return 'Investigational';
    case 'preclinical': return 'Preclinical';
    case 'research_chemical': return 'Research Compound';
    case 'cosmetic': return 'Cosmetic';
    default: return tier;
  }
}

function tierColor(tier: string | null): string {
  if (!tier) return '#A8B4C0';
  switch (tier) {
    case 'approved_drug': return '#68D391';
    case 'investigational': return '#00E5FF';
    case 'preclinical': return '#F6AD55';
    case 'research_chemical': return '#A8B4C0';
    case 'cosmetic': return '#D6BCFA';
    default: return '#A8B4C0';
  }
}

function riskMeta(level: string | null): { label: string; color: string } {
  if (!level) return { label: 'Unknown', color: '#A8B4C0' };
  switch (level) {
    case 'low_only':
    case 'low': return { label: 'Low Risk', color: '#68D391' };
    case 'moderate_ok':
    case 'moderate': return { label: 'Moderate', color: '#F6AD55' };
    case 'any':
    case 'high':
    case 'critical': return { label: 'High / Critical', color: '#FC8181' };
    default: return { label: level.replace(/_/g, ' '), color: '#A8B4C0' };
  }
}

interface SharedCompareModalProps {
  items: CompareItem[];
  onClose: () => void;
  storefrontMode?: boolean; 
  onOpenProduct?: (productId: string) => void;
}

export function SharedCompareModal({ items, onClose, storefrontMode, onOpenProduct }: SharedCompareModalProps) {
  const isHeadToHead = items.length === 2;
  let winnerIndex = -1;
  let isTie = false;

  if (isHeadToHead) {
    const a = items[0].score || 0;
    const b = items[1].score || 0;
    if (a > b) winnerIndex = 0;
    else if (b > a) winnerIndex = 1;
    else isTie = true;
  }

  const winStyle: React.CSSProperties = { color: '#3DD9A4', fontWeight: 900 };
  const loseStyle: React.CSSProperties = { color: '#A8B4C0', fontWeight: 700 };

  const getStyle = (idx: number) => {
    if (!isHeadToHead || isTie) return loseStyle;
    return idx === winnerIndex ? winStyle : loseStyle;
  };

  const getCheck = (idx: number) => {
    if (isHeadToHead && !isTie && idx === winnerIndex) return ' ✓';
    return '';
  };

  return (
    <>
      <style>{`
        .shared-compare-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          text-align: left;
          color: #E2E8F0;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          overflow: hidden;
        }
        .shared-compare-table thead tr {
          background: rgba(0,196,188,0.06);
        }
        .shared-compare-table th {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .shared-compare-table th.attr-col {
          color: #A8B4C0;
          font-weight: 700;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          width: 130px;
        }
        .shared-compare-table th.item-col {
          font-size: 1rem;
          font-weight: 800;
        }
        .shared-compare-table td {
          padding: 14px 16px;
          font-size: 0.9rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .shared-compare-table tr:last-child td {
          border-bottom: none;
        }
        .shared-compare-table td.attr-col {
          color: #A8B4C0;
          font-size: 0.82rem;
          font-weight: 700;
          white-space: nowrap;
        }

        /* Responsive Mobile Layout (Cards instead of Table) */
        .mobile-compare-view { display: none; flex-direction: column; gap: 16px; }
        .desktop-compare-view { display: block; }
        
        .compare-mobile-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 16px;
        }
        .compare-mobile-card.winner {
          border-color: rgba(61,217,164,0.3);
          background: rgba(61,217,164,0.05);
        }
        .cm-attr-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .cm-attr-row:last-child { border-bottom: none; }
        .cm-attr-label { color: #A8B4C0; font-size: 0.8rem; font-weight: 700; }
        .cm-attr-val { font-size: 0.9rem; font-weight: 600; text-align: right; }

        @media (max-width: 640px) {
          .mobile-compare-view { display: flex; }
          .desktop-compare-view { display: none; }
        }
      `}</style>
      <div
        className="no-print"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(5,10,18,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Head-to-head compound comparison"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', flex: 1,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(135deg, rgba(0,196,188,0.1) 0%, rgba(5,10,18,0) 60%)',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#00C4BC', marginBottom: 4 }}>
                {isHeadToHead ? 'Head-To-Head Comparison' : 'Compound Comparison'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {items.map((item, i) => (
                  <React.Fragment key={item.slug}>
                    {i > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', fontWeight: 700 }}>vs</span>}
                    <span style={{ color: (isHeadToHead && i === winnerIndex) ? '#3DD9A4' : '#C0C5CE', fontWeight: 800, fontSize: '1.05rem' }}>
                      {item.displayName}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close comparison"
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)',
                color: '#fff', borderRadius: 12, padding: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 44, minHeight: 44, flexShrink: 0,
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Winner banner */}
          {isHeadToHead && !isTie && winnerIndex !== -1 && (
            <div style={{
              background: 'rgba(61,217,164,0.07)',
              borderBottom: '1px solid rgba(61,217,164,0.2)',
              padding: '10px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
              flexShrink: 0,
            }}>
              <Sparkles size={14} color="#3DD9A4" />
              <span style={{ color: '#3DD9A4', fontSize: '0.82rem', fontWeight: 800 }}>
                {items[winnerIndex].displayName} Scores Higher For This Goal
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
                ({items[winnerIndex].score} vs {items[winnerIndex === 0 ? 1 : 0].score} points)
              </span>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
            {/* Desktop Table View */}
            <div className="desktop-compare-view">
              <table className="shared-compare-table">
                <thead>
                  <tr>
                    <th className="attr-col">Attribute</th>
                    {items.map((item, i) => (
                      <th key={item.slug} className="item-col">
                        <Link href={`/research/${item.slug}`} style={{ color: (isHeadToHead && i === winnerIndex) ? '#3DD9A4' : '#C0C5CE', textDecoration: 'none' }}>
                          {item.displayName}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {storefrontMode && (
                    <tr>
                      <td className="attr-col">Price</td>
                      {items.map(item => (
                        <td key={item.slug} style={{ fontWeight: 800, color: '#00C4BC' }}>
                          {item.price_cents ? `$${(item.price_cents / 100).toFixed(2)}` : 'Research Only'}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr>
                    <td className="attr-col">Match Score</td>
                    {items.map((item, i) => (
                      <td key={item.slug} style={getStyle(i)}>
                        {item.score || 0} / 100{getCheck(i)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="attr-col">Evidence Tier</td>
                    {items.map(item => (
                      <td key={item.slug} style={{ color: tierColor(item.evidenceTier), fontWeight: 700 }}>
                        {tierLabel(item.evidenceTier)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="attr-col">Safety Profile</td>
                    {items.map(item => (
                      <td key={item.slug} style={{ color: riskMeta(item.riskLevel).color, fontWeight: 700 }}>
                        {riskMeta(item.riskLevel).label}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="attr-col">Half-Life</td>
                    {items.map(item => <td key={item.slug}>{item.halfLife || 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="attr-col">Molecular Wt</td>
                    {items.map(item => <td key={item.slug}>{item.molecularWeight ? `${item.molecularWeight} Da` : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="attr-col">Storage</td>
                    {items.map(item => <td key={item.slug}>{item.isTempSensitive ? 'Cold Storage' : 'Room Temp'}</td>)}
                  </tr>
                </tbody>
              </table>

              {/* Desktop CTA Row */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
                {items.map((item, i) => {
                  const isWinner = isHeadToHead && i === winnerIndex;
                  return (
                    <div key={item.slug} style={{ display: 'flex', gap: 6 }}>
                      {storefrontMode ? (
                        <button
                          onClick={() => onOpenProduct?.(item.product_id || item.slug)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: isWinner ? 'linear-gradient(135deg,#3DD9A4,#00C4BC)' : 'rgba(255,255,255,0.06)', color: isWinner ? '#051a14' : '#C0C5CE', border: isWinner ? 'none' : '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          <ShoppingCart size={14} /> View Details
                        </button>
                      ) : (
                        <Link
                          href={`/research/${item.slug}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: isWinner ? 'linear-gradient(135deg,#3DD9A4,#00C4BC)' : 'rgba(255,255,255,0.06)', color: isWinner ? '#051a14' : '#C0C5CE', border: isWinner ? 'none' : '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none' }}
                        >
                          <Sparkles size={14} /> Research {item.displayName}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="mobile-compare-view">
              {items.map((item, i) => {
                const isWinner = isHeadToHead && i === winnerIndex;
                return (
                  <div key={item.slug} className={`compare-mobile-card ${isWinner ? 'winner' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Link href={`/research/${item.slug}`} style={{ color: isWinner ? '#3DD9A4' : '#FFF', fontSize: '1.1rem', fontWeight: 800, textDecoration: 'none' }}>
                        {item.displayName}
                      </Link>
                      {isWinner && <span style={{ background: '#3DD9A4', color: '#000', padding: '2px 6px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800 }}>WINNER</span>}
                    </div>

                    {storefrontMode && (
                      <div className="cm-attr-row">
                        <span className="cm-attr-label">Price</span>
                        <span className="cm-attr-val" style={{ color: '#00C4BC' }}>
                          {item.price_cents ? `$${(item.price_cents / 100).toFixed(2)}` : 'Research Only'}
                        </span>
                      </div>
                    )}
                    <div className="cm-attr-row">
                      <span className="cm-attr-label">Match Score</span>
                      <span className="cm-attr-val" style={getStyle(i)}>
                        {item.score || 0} / 100{getCheck(i)}
                      </span>
                    </div>
                    <div className="cm-attr-row">
                      <span className="cm-attr-label">Evidence Tier</span>
                      <span className="cm-attr-val" style={{ color: tierColor(item.evidenceTier) }}>
                        {tierLabel(item.evidenceTier)}
                      </span>
                    </div>
                    <div className="cm-attr-row">
                      <span className="cm-attr-label">Safety Profile</span>
                      <span className="cm-attr-val" style={{ color: riskMeta(item.riskLevel).color }}>
                        {riskMeta(item.riskLevel).label}
                      </span>
                    </div>
                    <div className="cm-attr-row">
                      <span className="cm-attr-label">Half-Life</span>
                      <span className="cm-attr-val">{item.halfLife || 'N/A'}</span>
                    </div>
                    <div className="cm-attr-row">
                      <span className="cm-attr-label">Molecular Wt</span>
                      <span className="cm-attr-val">{item.molecularWeight ? `${item.molecularWeight} Da` : 'N/A'}</span>
                    </div>
                    <div className="cm-attr-row">
                      <span className="cm-attr-label">Storage</span>
                      <span className="cm-attr-val">{item.isTempSensitive ? 'Cold Storage' : 'Room Temp'}</span>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      {storefrontMode ? (
                        <button
                          onClick={() => onOpenProduct?.(item.product_id || item.slug)}
                          style={{ width: '100%', padding: '12px', background: isWinner ? '#3DD9A4' : 'rgba(255,255,255,0.1)', color: isWinner ? '#000' : '#FFF', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                        >
                          <ShoppingCart size={16} /> View Details
                        </button>
                      ) : (
                        <Link
                          href={`/research/${item.slug}`}
                          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: isWinner ? '#3DD9A4' : 'rgba(255,255,255,0.1)', color: isWinner ? '#000' : '#FFF', borderRadius: 10, fontWeight: 800, textDecoration: 'none', boxSizing: 'border-box' }}
                        >
                          <Sparkles size={16} /> Research Profile
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
