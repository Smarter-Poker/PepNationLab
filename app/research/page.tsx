'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FlaskConical,
  Search,
  ChevronRight,
  Hexagon,
  BookOpen,
  Scale,
  Layers,
  Dna,
  PlusSquare,
  Brain,
  Flame,
  Infinity,
  Shield,
  Moon,
  Sparkles,
  Activity,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { evidenceTier } from '@/lib/compounds';

// Styles for the metallic text and borders
const metallicText = {
  background: 'linear-gradient(180deg, #E6D5B8 0%, #BBA371 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const metallicBorder = '1px solid rgba(187, 163, 113, 0.4)';
const cardBg = 'linear-gradient(180deg, rgba(16, 23, 34, 0.9) 0%, rgba(10, 15, 23, 0.95) 100%)';

export default function ResearchLibraryLandingPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState('');

  async function ask(queryArg?: string) {
    const query = (queryArg ?? q).trim();
    if (!query) return;
    if (queryArg) setQ(queryArg);
    setLoading(true);
    setResult(null);
    setSearched(query);
    try {
      const res = await fetch('/api/research/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ matches: [], message: 'Something Went Wrong. Please Try Again.' });
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      ask();
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#06090E',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '40px 20px',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      
      {/* HEADER SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '40px', maxWidth: '800px' }}>
        <h1 style={{
          ...metallicText,
          fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
          fontWeight: 900,
          letterSpacing: '0.05em',
          margin: '0 0 16px 0',
          textTransform: 'uppercase'
        }}>
          Research Library
        </h1>
        <p style={{
          color: '#A8B4C0',
          fontSize: 'clamp(1rem, 1.5vw, 1.25rem)',
          margin: 0,
          lineHeight: 1.5,
          fontWeight: 400
        }}>
          Your All-In-One Research Center For Compounds,<br />Mechanisms, And Laboratory Insights.
        </p>
      </div>

      <div style={{ maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* ASK THE LAB - SEARCH BAR */}
        <div style={{
          background: cardBg,
          border: metallicBorder,
          borderRadius: '16px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <FlaskConical size={32} color="#BBA371" />
            <h2 style={{ ...metallicText, fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '0.1em' }}>
              ASK THE LAB
            </h2>
          </div>
          <p style={{ color: '#A8B4C0', fontSize: '1rem', margin: '0 0 24px 0', textAlign: 'center' }}>
            Search Compounds, Mechanisms, Targets, Pathways, Stacks, And More.
          </p>

          <div style={{
            display: 'flex',
            width: '100%',
            maxWidth: '700px',
            position: 'relative',
            borderRadius: '999px',
            border: metallicBorder,
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.5)'
          }}>
            <div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)' }}>
              <Search size={20} color="#A8B4C0" />
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search Any Compound, Mechanism, Target, Pathway, Or Category..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: '16px 20px 16px 52px',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
                width: '100%'
              }}
            />
            <button
              onClick={() => ask()}
              disabled={loading || !q.trim()}
              style={{
                background: 'linear-gradient(180deg, #E6D5B8 0%, #A28A55 100%)',
                border: 'none',
                padding: '0 32px',
                color: '#101722',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading || !q.trim() ? 'default' : 'pointer',
                transition: 'opacity 0.2s',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* SEARCH RESULTS EXPANSION */}
          {result && (
            <div style={{ width: '100%', maxWidth: '700px', marginTop: '24px', textAlign: 'left' }}>
               {result.matches.length === 0 ? (
                 <p style={{ color: '#A8B4C0', textAlign: 'center' }}>
                   {result.message ?? 'No Matching Compound Found. Try A Goal Like Recovery Or Sleep.'}
                 </p>
               ) : (
                 <div style={{ display: 'grid', gap: '16px' }}>
                    <p style={{ color: '#BBA371', fontSize: '0.9rem', marginBottom: '8px' }}>
                      {result.matches.length} Matches For "{searched}"
                    </p>
                    {result.matches.map((m: any) => {
                      const tier = evidenceTier(m.evidence_tier);
                      return (
                        <Link
                          key={m.slug}
                          href={`/research/${m.slug}`}
                          style={{
                            display: 'block',
                            padding: '16px',
                            borderRadius: '12px',
                            background: 'rgba(0,0,0,0.3)',
                            border: metallicBorder,
                            textDecoration: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span style={{ color: '#E6D5B8', fontWeight: 700, fontSize: '1.1rem' }}>{m.name}</span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                color: tier.color,
                                border: `1px solid ${tier.color}`,
                                background: 'rgba(0,0,0,0.2)',
                              }}
                            >
                              {tier.label}
                            </span>
                          </div>
                          <p style={{ margin: 0, color: '#A8B4C0', fontSize: '0.9rem', lineHeight: 1.5 }}>{m.composed}</p>
                        </Link>
                      );
                    })}
                 </div>
               )}
            </div>
          )}
        </div>

        {/* 4 MAIN BUTTONS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          <Link href="/research/areas" style={{ textDecoration: 'none' }}>
            <div style={{
              background: cardBg, border: metallicBorder, borderRadius: '16px', padding: '24px',
              display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%', border: metallicBorder,
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)'
              }}>
                <Hexagon size={40} color="#BBA371" />
              </div>
              <div style={{ flex: 1, paddingRight: '32px' }}>
                <h3 style={{ ...metallicText, fontSize: '1.5rem', margin: '0 0 8px 0', fontWeight: 700 }}>Therapeutic<br/>Areas</h3>
                <p style={{ color: '#A8B4C0', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>Explore Compounds By Research And Therapeutic Focus Areas.</p>
              </div>
              <div style={{ position: 'absolute', right: '24px', bottom: '24px', width: '28px', height: '28px', borderRadius: '50%', border: metallicBorder, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={16} color="#BBA371" />
              </div>
            </div>
          </Link>

          <Link href="/research/catalog" style={{ textDecoration: 'none' }}>
            <div style={{
              background: cardBg, border: metallicBorder, borderRadius: '16px', padding: '24px',
              display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%', border: metallicBorder,
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)'
              }}>
                <BookOpen size={40} color="#BBA371" />
              </div>
              <div style={{ flex: 1, paddingRight: '32px' }}>
                <h3 style={{ ...metallicText, fontSize: '1.5rem', margin: '0 0 8px 0', fontWeight: 700 }}>Browse<br/>Catalog</h3>
                <p style={{ color: '#A8B4C0', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>View And Filter The Full Catalog Of Research Compounds.</p>
              </div>
              <div style={{ position: 'absolute', right: '24px', bottom: '24px', width: '28px', height: '28px', borderRadius: '50%', border: metallicBorder, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={16} color="#BBA371" />
              </div>
            </div>
          </Link>

          <Link href="/research/compare" style={{ textDecoration: 'none' }}>
            <div style={{
              background: cardBg, border: metallicBorder, borderRadius: '16px', padding: '24px',
              display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%', border: metallicBorder,
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)'
              }}>
                <Scale size={40} color="#BBA371" />
              </div>
              <div style={{ flex: 1, paddingRight: '32px' }}>
                <h3 style={{ ...metallicText, fontSize: '1.5rem', margin: '0 0 8px 0', fontWeight: 700 }}>Compare<br/>Compounds</h3>
                <p style={{ color: '#A8B4C0', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>Compare Compounds Side-By-Side With Key Research Data.</p>
              </div>
              <div style={{ position: 'absolute', right: '24px', bottom: '24px', width: '28px', height: '28px', borderRadius: '50%', border: metallicBorder, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={16} color="#BBA371" />
              </div>
            </div>
          </Link>

          <Link href="/research/stacks" style={{ textDecoration: 'none' }}>
            <div style={{
              background: cardBg, border: metallicBorder, borderRadius: '16px', padding: '24px',
              display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%', border: metallicBorder,
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)'
              }}>
                <Layers size={40} color="#BBA371" />
              </div>
              <div style={{ flex: 1, paddingRight: '32px' }}>
                <h3 style={{ ...metallicText, fontSize: '1.5rem', margin: '0 0 8px 0', fontWeight: 700 }}>Stacks &<br/>Combinations</h3>
                <p style={{ color: '#A8B4C0', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>Explore Synergistic Stacks And Proven Compound Combinations.</p>
              </div>
              <div style={{ position: 'absolute', right: '24px', bottom: '24px', width: '28px', height: '28px', borderRadius: '50%', border: metallicBorder, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={16} color="#BBA371" />
              </div>
            </div>
          </Link>

        </div>

        {/* QUICK ACCESS SECTION */}
        <div style={{
          background: 'rgba(16, 23, 34, 0.4)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '8px'
        }}>
          <h4 style={{ ...metallicText, fontSize: '1rem', letterSpacing: '0.2em', margin: '0 0 20px 0', textTransform: 'uppercase' }}>
            QUICK ACCESS
          </h4>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            
            <QuickAccessPill href="/research/area/tissue_repair" icon={<Dna size={18} color="#00E5FF" />} label="Tissue Repair" />
            <QuickAccessPill href="/research/area/healing" icon={<PlusSquare size={18} color="#4ADE80" />} label="Healing & Recovery" />
            <QuickAccessPill href="/research/area/cognitive" icon={<Brain size={18} color="#A78BFA" />} label="Cognitive" />
            <QuickAccessPill href="/research/area/metabolic" icon={<Flame size={18} color="#FB923C" />} label="Metabolic" />
            <QuickAccessPill href="/research/area/longevity" icon={<Infinity size={18} color="#2DD4BF" />} label="Longevity" />
            
            <QuickAccessPill href="/research/area/immune" icon={<Shield size={18} color="#38BDF8" />} label="Immune" />
            <QuickAccessPill href="/research/area/sleep" icon={<Moon size={18} color="#818CF8" />} label="Sleep" />
            <QuickAccessPill href="/research/area/cosmetic" icon={<Sparkles size={18} color="#F472B6" />} label="Skin & Hair" />
            <QuickAccessPill href="/research/area/performance" icon={<Activity size={18} color="#4ADE80" />} label="Performance" />
            <QuickAccessPill href="/research/area/mitochondrial" icon={<Zap size={18} color="#2DD4BF" />} label="Mitochondrial" />
            
          </div>
        </div>

        {/* FOOTER DISCLAIMER PILL */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(187, 163, 113, 0.3)',
            borderRadius: '999px',
            padding: '12px 24px',
          }}>
            <ShieldCheck size={18} color="#BBA371" />
            <span style={{ color: '#A8B4C0', fontSize: '0.9rem', letterSpacing: '0.02em' }}>
              Research Use Only <span style={{ color: '#BBA371', margin: '0 8px' }}>•</span> Not For Human Use <span style={{ color: '#BBA371', margin: '0 8px' }}>•</span> Laboratory Research Only
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

function QuickAccessPill({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '12px 20px',
        transition: 'background 0.2s, border-color 0.2s',
        cursor: 'pointer',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        e.currentTarget.style.borderColor = 'rgba(187, 163, 113, 0.4)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
      }}>
        {icon}
        <span style={{ color: '#D0DAE4', fontSize: '0.95rem', fontWeight: 500 }}>{label}</span>
      </div>
    </Link>
  );
}
