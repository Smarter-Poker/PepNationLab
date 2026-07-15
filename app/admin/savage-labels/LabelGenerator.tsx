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

export function LabelGenerator({ savageProducts, pepProducts }: { savageProducts: any[], pepProducts: any[] }) {
  const [isExporting, setIsExporting] = useState(false);
  const [brand, setBrand] = useState<'savage' | 'pepnation'>('savage');
  const containerRef = useRef<HTMLDivElement>(null);

  const products = brand === 'savage' ? savageProducts : pepProducts;

  const handleExport = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);

    try {
      const zip = new JSZip();
      const images = containerRef.current.querySelectorAll('img.label-image');
      
      for (const img of Array.from(images) as HTMLImageElement[]) {
        const productName = img.getAttribute('data-name') || 'label';
        
        // Fetch the image blob
        const response = await fetch(img.src);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`${productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`, blob);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${brand}-brands-labels.zip`);
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
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium">{products.length} Labels Available</h2>
          <select 
            value={brand} 
            onChange={(e) => setBrand(e.target.value as 'savage' | 'pepnation')}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-[200px] items-center justify-between rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="savage">Savage Brands</option>
            <option value="pepnation">Pep Nation</option>
          </select>
        </div>
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
        Note: The labels below are exactly matched to the template image you provided. They are rendered at 1024x512 pixels natively.
      </div>

      <div 
        ref={containerRef} 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        {products.map((p) => {
          const folder = brand === 'savage' ? 'savage-brands-flattened' : 'pep-nation-flattened';
          const slug = p.slug || p.name.replace(/\s+/g, '-').toLowerCase();
          const safeSlug = slug.replace(/\//g, '_').replace(/ /g, '_');
          const imageUrl = `/images/${folder}/${safeSlug}.png`;

          return (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div 
                className="overflow-hidden border border-border/50 rounded shadow-md relative bg-black flex items-center justify-center"
                style={{ width: '394px', height: '197px' }}
              >
                <img 
                  src={imageUrl} 
                  alt={p.name}
                  data-name={p.name}
                  className="label-image"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    // Hide if image doesn't exist yet
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<span class="text-xs text-muted-foreground">Generating...</span>';
                  }}
                />
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
