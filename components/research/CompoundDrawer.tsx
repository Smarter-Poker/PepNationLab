'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface ScoreBreakdown {
  base: number;
  keyword: number;
  evidenceBonus: number;
  classBonus: number;
}

interface MatchResult {
  slug: string;
  displayName: string;
  score: number;
  rationale: string;
  evidenceTier: string;
  wadaStatus: string;
  riskLevel: string;
  halfLife: string | null;
  molecularWeight: number | null;
  isTempSensitive: boolean;
  scoreBreakdown: ScoreBreakdown;
  isStackPartner?: boolean;
}

interface CompoundDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  result: MatchResult | null;
}

export default function CompoundDrawer({ isOpen, onClose, result }: CompoundDrawerProps) {
  if (!result) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998,
            }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.x > 100) onClose();
            }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '480px',
              background: 'var(--black, #0A1118)',
              borderLeft: '1px solid rgba(168,180,192,0.1)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
              zIndex: 9999,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: 'var(--space-4, 16px)', borderBottom: '1px solid rgba(168,180,192,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'rgba(10,17,24,0.9)', backdropFilter: 'blur(8px)' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: 0 }}>
                  {result.displayName}
                </h2>
                <div style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', fontWeight: 700 }}>
                  Match Score: {result.score} / 100
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: 'var(--silver, #A8B4C0)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 'var(--space-5, 24px)', flex: 1 }}>
              <div style={{ marginBottom: 'var(--space-6, 32px)' }}>
                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-2, 8px)' }}>
                  Why This Matched
                </h3>
                <p style={{ color: 'var(--white, #FFFFFF)', fontSize: '1.05rem', lineHeight: 1.6, margin: 0 }}>
                  {result.rationale}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-6, 32px)' }}>
                <div style={{ background: 'var(--grey-400, #162230)', padding: 'var(--space-3, 12px)', borderRadius: 'var(--radius-md, 8px)' }}>
                  <ShieldCheck size={20} color="var(--teal, #00C4BC)" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>Evidence Tier</div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)', fontSize: '0.95rem' }}>{result.evidenceTier.replace('_', ' ')}</div>
                </div>
                <div style={{ background: 'var(--grey-400, #162230)', padding: 'var(--space-3, 12px)', borderRadius: 'var(--radius-md, 8px)' }}>
                  <AlertTriangle size={20} color="var(--orange, #FCA311)" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>Risk Level</div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)', fontSize: '0.95rem', textTransform: 'capitalize' }}>{result.riskLevel}</div>
                </div>
                <div style={{ background: 'var(--grey-400, #162230)', padding: 'var(--space-3, 12px)', borderRadius: 'var(--radius-md, 8px)' }}>
                  <Activity size={20} color="#63B3ED" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>Storage Temp</div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)', fontSize: '0.95rem' }}>{result.isTempSensitive ? 'Cold Storage' : 'Room Temp'}</div>
                </div>
                <div style={{ background: 'var(--grey-400, #162230)', padding: 'var(--space-3, 12px)', borderRadius: 'var(--radius-md, 8px)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <div style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>Half-Life</div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)', fontSize: '0.95rem' }}>{result.halfLife || 'Unknown'}</div>
                </div>
              </div>

              <div style={{ marginBottom: 'var(--space-6, 32px)' }}>
                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-3, 12px)' }}>
                  Detailed Score Breakdown
                </h3>
                <div style={{ background: 'var(--grey-400, #162230)', borderRadius: 'var(--radius-md, 8px)', padding: 'var(--space-4, 16px)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>Base Suitability</span>
                    <span style={{ color: 'var(--white, #FFFFFF)', fontWeight: 700 }}>+{result.scoreBreakdown.base}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>Goal Match (Keywords)</span>
                    <span style={{ color: 'var(--teal, #00C4BC)', fontWeight: 700 }}>+{result.scoreBreakdown.keyword}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>Evidence Tier Bonus</span>
                    <span style={{ color: '#63B3ED', fontWeight: 700 }}>+{result.scoreBreakdown.evidenceBonus}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ color: 'var(--white, #FFFFFF)', fontSize: '0.95rem', fontWeight: 700 }}>Total Final Score</span>
                    <span style={{ color: 'var(--teal, #00C4BC)', fontWeight: 800, fontSize: '1.1rem' }}>{result.score}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: 'var(--space-4, 16px)', borderTop: '1px solid rgba(168,180,192,0.1)', background: 'var(--grey-400, #162230)' }}>
              <Link
                href={`/research/${result.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'var(--teal, #00C4BC)',
                  color: 'var(--black, #0A1118)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md, 8px)',
                  textDecoration: 'none',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                View Full Dossier <ExternalLink size={18} />
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
