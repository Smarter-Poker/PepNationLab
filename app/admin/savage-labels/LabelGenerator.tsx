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
                  {/* Main centered box with thin colored border representing the front face */}
                  <div 
                    className="relative z-10 flex flex-col items-center justify-between"
                    style={{
                      width: '320px',
                      height: '270px',
                      border: `3px solid ${accentColor}`,
                      borderRadius: '2px',
                      padding: '12px 0 8px 0',
                      boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
                    }}
                  >
                    {/* Top Text: SAVAGE BRANDS */}
                    <div className="flex flex-col items-center justify-center leading-none relative z-20">
                      <h1 
                        style={{ 
                          fontFamily: '"Arial Black", "Helvetica Neue", sans-serif', 
                          fontSize: '48px', 
                          fontWeight: 900,
                          lineHeight: '0.9',
                          letterSpacing: '1px',
                          background: 'linear-gradient(to bottom, #ffffff 0%, #d0d0d0 40%, #707070 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.8))',
                          margin: 0
                        }}
                      >
                        SAVAGE
                      </h1>
                      <h2
                        style={{ 
                          fontFamily: '"Arial Black", "Helvetica Neue", sans-serif', 
                          fontSize: '48px', 
                          fontWeight: 900,
                          lineHeight: '0.9',
                          letterSpacing: '1px',
                          background: 'linear-gradient(to bottom, #ffffff 0%, #d0d0d0 40%, #707070 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.8))',
                          margin: 0,
                          marginTop: '-4px'
                        }}
                      >
                        BRANDS
                      </h2>
                    </div>

                    {/* Claws Logo - Positioned absolutely to overlap */}
                    <div 
                      className="absolute"
                      style={{ 
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '200px',
                        height: '140px',
                        zIndex: 10,
                        opacity: 0.95
                      }}
                    >
                       <svg width="100%" height="100%" viewBox="0 0 250 300" style={{ transform: 'rotate(25deg)', filter: `drop-shadow(0 4px 6px rgba(0,0,0,0.6))` }}>
                          <path d="M20 20 C40 120 70 240 20 340 C70 260 60 140 20 20 Z" fill={accentColor} />
                          <path d="M85 0 C105 100 135 220 85 320 C135 240 125 120 85 0 Z" fill={accentColor} />
                          <path d="M150 30 C170 130 200 250 150 350 C200 270 190 150 150 30 Z" fill={accentColor} />
                          <path d="M215 50 C235 150 265 270 215 370 C265 290 255 170 215 50 Z" fill={accentColor} />
                       </svg>
                    </div>

                    {/* Bottom Content Container */}
                    <div className="flex flex-col items-center justify-end w-full relative z-20">
                      {/* Product Name */}
                      <h3 
                        style={{ 
                          fontFamily: '"Arial Black", "Helvetica Neue", sans-serif', 
                          fontWeight: 900,
                          fontSize: p.name.length > 20 ? '20px' : '28px', 
                          lineHeight: '1',
                          background: 'linear-gradient(to bottom, #ffffff 0%, #c0c0c0 50%, #808080 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.8))',
                          margin: '0 0 6px 0',
                          textTransform: 'uppercase',
                          textAlign: 'center',
                          padding: '0 10px'
                        }}
                      >
                        {p.name}
                      </h3>
                      
                      {/* Category & Dose */}
                      <div 
                        style={{ 
                          color: '#e0e0e0', 
                          fontFamily: 'Arial, sans-serif',
                          fontSize: '14px',
                          fontWeight: 400,
                          lineHeight: '1.2',
                          textAlign: 'center'
                        }}
                      >
                        {categoryName}
                        <br/>
                        <span style={{ fontSize: '18px', fontWeight: 600 }}>{doseString}</span>
                      </div>
                    </div>
                  </div>
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
