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
          
          const cleanName = p.name.replace(/\s*\(.*?\)\s*/g, '').trim();
          const subtitleMatch = p.name.match(/\((.*?)\)/);
          const subtitle = subtitleMatch ? subtitleMatch[1] : '';

          return (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div 
                className="overflow-hidden border border-border/50 rounded shadow-md relative"
                style={{ width: '394px', height: '150px' }}
              >
                <div 
                  className="savage-label-render-target relative overflow-hidden"
                  data-name={p.name}
                  style={{
                    width: '788px',
                    height: '300px',
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left',
                    backgroundColor: '#161616', // Solid dark gray/black texture, no hex pattern
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  {/* Top Border */}
                  <div style={{ width: '100%', height: '18px', backgroundColor: accentColor, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} />

                  {/* Main content box */}
                  <div 
                    style={{
                      position: 'relative',
                      zIndex: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 1,
                      width: '100%',
                      padding: '10px 20px',
                    }}
                  >
                    {/* Real Savage Brands Logo Image */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 20 }}>
                      <img 
                        src="/images/savage-brands/savage-logo.png" 
                        alt="Savage Brands Logo" 
                        style={{
                          width: '320px',
                          height: 'auto',
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.8))'
                        }}
                        onError={(e) => {
                          // Fallback styling if image isn't saved yet
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    {/* Bottom Content Container */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: '100%', position: 'relative', zIndex: 20 }}>
                      {/* Product Name */}
                      <h3 
                        style={{ 
                          fontFamily: 'Impact, "Arial Black", sans-serif', 
                          fontWeight: 900,
                          fontSize: cleanName.length > 20 ? '36px' : '44px', 
                          lineHeight: '1',
                          background: 'linear-gradient(to bottom, #ffffff 0%, #d0d0d0 40%, #707070 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.9))',
                          margin: '0 0 10px 0',
                          textTransform: 'uppercase',
                          textAlign: 'center',
                          padding: '0 10px',
                          transform: 'scaleY(1.5) scaleX(0.85)',
                          letterSpacing: '1px'
                        }}
                      >
                        {cleanName}
                      </h3>
                      
                      {/* Subtitle / Category / Dose */}
                      <div 
                        style={{ 
                          color: accentColor, 
                          fontFamily: 'Arial, sans-serif',
                          fontSize: '22px',
                          fontWeight: 700,
                          lineHeight: '1',
                          textAlign: 'center',
                          textTransform: 'none',
                          letterSpacing: '0px'
                        }}
                      >
                        {(subtitle || categoryName).replace(/ & Metabolism/i, '').replace(/ \& Metabolism/i, '')} {doseString.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Border */}
                  <div style={{ width: '100%', height: '18px', backgroundColor: accentColor, boxShadow: '0 -2px 4px rgba(0,0,0,0.5)' }} />
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
