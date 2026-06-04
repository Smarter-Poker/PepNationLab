'use client';

/**
 * StructureViewer3D -- loads a 3D structure via NGL.js from RCSB PDB or
 * AlphaFold. Component is fully isolated; NGL is loaded dynamically via a
 * <script> tag at runtime because NGL is not bundle-friendly.
 *
 * Research use only. No human dosing.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  pdbId?: string | null;
  alphafoldId?: string | null;
  sequence?: string | null;
  height?: number;
}

declare global {
  interface Window {
    NGL?: {
      Stage: new (el: HTMLElement, opts?: Record<string, unknown>) => {
        loadFile: (path: string, opts?: Record<string, unknown>) => Promise<{ addRepresentation: (n: string) => void; autoView: () => void }>;
        setParameters: (p: Record<string, unknown>) => void;
        handleResize: () => void;
        dispose: () => void;
      };
    };
  }
}

const NGL_SRC = 'https://unpkg.com/ngl@latest/dist/ngl.js';

export default function StructureViewer3D({ pdbId, alphafoldId, sequence, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'empty'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!pdbId && !alphafoldId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('empty');
      return;
    }
    setStatus('loading');
    setErrorMsg(null);

    let cancelled = false;
    let stage: ReturnType<NonNullable<typeof window.NGL>['Stage']['prototype']['constructor']> | null = null;

    function ensureScript(): Promise<void> {
      if (typeof window === 'undefined') return Promise.reject(new Error('No Window'));
      if (window.NGL) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-ngl="true"]`) as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('NGL Failed To Load')));
          return;
        }
        const s = document.createElement('script');
        s.src = NGL_SRC;
        s.async = true;
        s.dataset.ngl = 'true';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('NGL Failed To Load'));
        document.head.appendChild(s);
      });
    }

    (async () => {
      try {
        await ensureScript();
        if (cancelled || !containerRef.current || !window.NGL) return;
        const NGL = window.NGL;
        const StageCls = NGL.Stage as unknown as new (el: HTMLElement, opts?: Record<string, unknown>) => {
          loadFile: (path: string, opts?: Record<string, unknown>) => Promise<{ addRepresentation: (n: string) => void; autoView: () => void }>;
          setParameters: (p: Record<string, unknown>) => void;
          handleResize: () => void;
          dispose: () => void;
        };
        stage = new StageCls(containerRef.current, { backgroundColor: '#0F1923' });
        const loadPath = pdbId
          ? `rcsb://${pdbId}`
          : `https://alphafold.ebi.ac.uk/files/AF-${alphafoldId}-F1-model_v4.pdb`;
        const component = await stage.loadFile(loadPath);
        if (cancelled) return;
        component.addRepresentation('cartoon');
        component.autoView();
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Unknown Error');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (stage) stage.dispose();
      } catch {
        // ignore
      }
    };
  }, [pdbId, alphafoldId]);

  if (status === 'empty') {
    return (
      <div className="glass-panel" style={{ padding: 20, borderRadius: 12, color: '#A8B4C0', fontSize: 14 }}>
        No 3D Structure Is Yet Annotated For This Compound. {sequence ? 'Sequence Available; AlphaFold Prediction Pending.' : ''}
      </div>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          background: '#0F1923',
          borderRadius: 12,
          border: '1px solid rgba(168,180,192,0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A8B4C0' }}>
            Loading 3D Structure...
          </div>
        )}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E53E3E', textAlign: 'center', padding: 20 }}>
            Could Not Load 3D Structure. {errorMsg ?? ''}
          </div>
        )}
      </div>
      <p style={{ marginTop: 10, fontSize: 11, color: '#A8B4C0', fontStyle: 'italic' }}>
        Structural Data Sourced From RCSB Protein Data Bank Or AlphaFold. Research Use Only.
      </p>
    </div>
  );
}
