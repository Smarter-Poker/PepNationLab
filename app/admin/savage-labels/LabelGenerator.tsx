'use client';

import React, { useState, useRef } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function getCategoryColor(categoryName: string) {
  const normalized = categoryName?.toLowerCase() || '';
  if (normalized.includes('weight loss')) return '#FF0000';
  if (normalized.includes('healing') || normalized.includes('recovery')) return '#008080';
  if (normalized.includes('growth hormone')) return '#FFD700';
  if (normalized.includes('muscle')) return '#4169E1';
  if (normalized.includes('sexual')) return '#800080';
  if (normalized.includes('anti-aging')) return '#B76E79';
  if (normalized.includes('skin') || normalized.includes('hair')) return '#50C878';
  if (normalized.includes('nootropic')) return '#C0C0C0';
  if (normalized.includes('stack')) return '#FFFFFF';
  return '#C0C0C0';
}

export function LabelGenerator({ products }: { products: any[] }) {
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);

    try {
      const zip = new JSZip();
      const labelElements = containerRef.current.querySelectorAll('.savage-label-render-target');
      
      const elementsArray = Array.from(labelElements) as HTMLElement[];
      
      for (const el of elementsArray) {
        const productName = el.getAttribute('data-name') || 'label';
        const blob = await toBlob(el, {
          quality: 1.0,
          pixelRatio: 1,
        });
        
        if (blob) {
          zip.file(`${productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`, blob);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'savage-brands-labels.zip');
    } catch (error) {
      console.error('Error generating ZIP:', error);
      alert('Failed to export labels. Check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{products.length} Labels Available</h2>
        <button 
          onClick={handleExport} 
          disabled={isExporting}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 bg-blue-600 text-white"
        >
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {isExporting ? 'Generating ZIP...' : 'Export All to ZIP (300dpi)'}
        </button>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        Note: The labels below are scaled down for preview purposes, but will be exported at full 300dpi resolution (788x300 pixels, exactly 2-5/8" x 1").
      </div>

      <div 
        ref={containerRef} 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        {products.map((p) => {
          const categoryName = p.category || 'Unknown';
          const accentColor = getCategoryColor(categoryName);
          const doseString = p.unit_size && p.unit_measure ? `${p.unit_size}${p.unit_measure}` : '';

          return (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div 
                className="overflow-hidden border border-border/50 rounded shadow-md relative"
                style={{ width: '394px', height: '150px' }}
              >
                <div 
                  className="savage-label-render-target relative bg-[#111] overflow-hidden flex flex-col justify-between"
                  data-name={p.name}
                  style={{
                    width: '788px',
                    height: '300px',
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left',
                    backgroundImage: `
                      linear-gradient(30deg, #181818 12%, transparent 12.5%, transparent 87%, #181818 87.5%, #181818),
                      linear-gradient(150deg, #181818 12%, transparent 12.5%, transparent 87%, #181818 87.5%, #181818),
                      linear-gradient(30deg, #181818 12%, transparent 12.5%, transparent 87%, #181818 87.5%, #181818),
                      linear-gradient(150deg, #181818 12%, transparent 12.5%, transparent 87%, #181818 87.5%, #181818),
                      linear-gradient(60deg, #1a1a1a 25%, transparent 25.5%, transparent 75%, #1a1a1a 75%, #1a1a1a),
                      linear-gradient(60deg, #1a1a1a 25%, transparent 25.5%, transparent 75%, #1a1a1a 75%, #1a1a1a)
                    `,
                    backgroundSize: '40px 70px',
                    backgroundPosition: '0 0, 0 0, 20px 35px, 20px 35px, 0 0, 20px 35px'
                  }}
                >
                  <div style={{ height: '12px', width: '100%', backgroundColor: accentColor }}></div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                     <svg width="250" height="300" viewBox="0 0 250 300" style={{ transform: 'rotate(-20deg)', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))' }}>
                        <path d="M40 0 C60 100 80 200 40 300 C80 220 70 120 40 0 Z" fill={accentColor} />
                        <path d="M125 20 C145 120 165 220 125 320 C165 240 155 140 125 20 Z" fill={accentColor} />
                        <path d="M210 40 C230 140 250 240 210 340 C250 260 240 160 210 40 Z" fill={accentColor} />
                     </svg>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-8 text-center">
                    <div className="flex flex-col items-center justify-center mb-1">
                      <h1 
                        style={{ 
                          fontFamily: 'Impact, sans-serif', 
                          fontSize: '64px', 
                          lineHeight: '1',
                          letterSpacing: '-2px',
                          background: 'linear-gradient(to bottom, #f0f0f0, #a0a0a0, #d0d0d0)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          textShadow: '0 4px 6px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.4)',
                          transform: 'skewX(-10deg)',
                          margin: 0
                        }}
                      >
                        SAVAGE
                      </h1>
                      <h2
                        style={{ 
                          fontFamily: 'Impact, sans-serif', 
                          fontSize: '28px', 
                          lineHeight: '1',
                          letterSpacing: '4px',
                          background: 'linear-gradient(to bottom, #d0d0d0, #808080)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                          transform: 'skewX(-10deg)',
                          marginTop: '-4px'
                        }}
                      >
                        BRANDS
                      </h2>
                    </div>

                    <h3 
                      style={{ 
                        fontFamily: 'Arial, sans-serif', 
                        fontWeight: '900',
                        fontSize: p.name.length > 25 ? '32px' : '44px', 
                        lineHeight: '1.1',
                        color: '#E0E0E0',
                        textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                        margin: '6px 0 0 0'
                      }}
                      className="uppercase tracking-tighter"
                    >
                      {p.name}
                    </h3>
                    <div 
                      style={{ 
                        color: accentColor, 
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '22px',
                        fontWeight: 700,
                        marginTop: '4px'
                      }}
                    >
                      {categoryName} {doseString}
                    </div>
                  </div>

                  <div style={{ height: '12px', width: '100%', backgroundColor: accentColor }}></div>
                </div>
              </div>
              <div className="text-sm font-medium text-center truncate w-full" title={p.name}>
                {p.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
