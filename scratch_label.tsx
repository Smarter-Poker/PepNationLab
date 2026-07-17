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
  const [brand, setBrand] = useState<'savage' | 'pepnation'>('savage');
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
          zip.file(`${brand}-${productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`, blob);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${brand}-labels.zip`);
    } catch (error) {
      console.error('Error generating ZIP:', error);
      alert('Failed to export labels. Check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  const logoSrc = brand === 'savage' ? '/images/logo-savage.jpg' : '/logo.jpg';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium">{products.length} Labels Available</h2>
          <select 
            value={brand} 
            onChange={(e) => setBrand(e.target.value as any)}
            className="border border-input bg-background rounded-md px-3 py-1.5 text-sm font-medium"
          >
            <option value="savage">Savage Brands Labels</option>
            <option value="pepnation">Pep Nation Labels</option>
          </select>
        </div>
        <button 
          onClick={handleExport} 
          disabled={isExporting}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-primary/90 h-10 py-2 px-4 bg-blue-600 text-white"
        >
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {isExporting ? 'Generating ZIP...' : `Export ${brand === 'savage' ? 'Savage Brands' : 'Pep Nation'} to ZIP`}
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

          return (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div 
                className="overflow-hidden border border-border/50 rounded shadow-md relative"
                style={{ width: '394px', height: '150px' }}
              >
                <div 
                  className="savage-label-render-target relative overflow-hidden flex"
                  data-name={p.name}
                  style={{
                    width: '788px',
                    height: '300px',
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left',
                    backgroundColor: '#050505',
                    fontFamily: '"Arial Black", Impact, "Helvetica Neue", sans-serif',
                    borderTop: `12px solid ${accentColor}`,
                    borderBottom: `12px solid ${accentColor}`,
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Left Side: Logo Area */}
                  <div style={{ 
                    width: '330px', 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '20px'
                  }}>
                    <img 
                      src={logoSrc} 
                      alt="Brand Logo" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain'
                      }}
                      onError={(e) => { 
                        e.currentTarget.style.display = 'none'; 
                      }}
                    />
                  </div>

                  {/* Right Side: Text Area */}
                  <div style={{ 
                    flex: 1, 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center',
                    paddingTop: '20px'
                  }}>
                    
                    <div style={{ paddingRight: '30px' }}>
                      {/* Silver Horizontal Line */}
                      <div style={{ 
                        width: '100%', 
                        height: '4px', 
                        background: 'linear-gradient(to right, #ffffff 0%, #a0a0a0 50%, #ffffff 100%)',
                        marginBottom: '8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.8)'
                      }} />

                      {/* Product Name (e.g. BPC-157) */}
                      <div style={{
                        fontSize: cleanName.length > 8 ? '85px' : '110px',
                        fontWeight: '900',
                        lineHeight: '1.1',
                        textTransform: 'uppercase',
                        background: 'linear-gradient(to bottom, #ffffff 0%, #d4d4d4 40%, #808080 50%, #c0c0c0 60%, #ffffff 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.9))',
                        letterSpacing: '-1px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {cleanName}
                      </div>

                      {/* RESEARCH COMPOUND subtitle */}
                      <div style={{
                        fontSize: '38px',
                        fontWeight: '800',
                        color: '#a3a3a3',
                        fontFamily: '"Arial Black", Impact, sans-serif',
                        textTransform: 'uppercase',
                        letterSpacing: '0px',
                        marginTop: '0px',
                        marginBottom: '20px'
                      }}>
                        RESEARCH COMPOUND
                      </div>
                    </div>

                    {/* Bottom Color Bar with Dosage */}
                    <div style={{
                      width: '100%',
                      backgroundColor: accentColor,
                      padding: '12px 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '-10px'
                    }}>
                      <div style={{ 
                        color: '#000000', 
                        fontSize: '32px', 
                        fontFamily: '"Helvetica Neue", Arial, sans-serif',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px' 
                      }}>
                        {doseString && <span style={{ fontWeight: '900' }}>{doseString}</span>}
                        {doseString && <span style={{ fontWeight: '500' }}>-</span>}
                        <span style={{ fontWeight: '500' }}>Research Compound</span>
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
