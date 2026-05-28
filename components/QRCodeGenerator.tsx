'use client';

import React, { useEffect, useRef, useState } from 'react';

interface QRCodeGeneratorProps {
  url: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
}

export default function QRCodeGenerator({ url, size = 200, fgColor = '#00C4BC', bgColor = '#FFFFFF' }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;

    // Dynamic import of qrcode library (works client-side only)
    import('qrcode').then((QRCode) => {
      QRCode.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 2,
        color: {
          dark: fgColor,
          light: bgColor,
        },
        errorCorrectionLevel: 'M',
      }, (err: Error | null | undefined) => {
        if (err) {
          console.error('QR Code generation failed:', err);
          setError(true);
          return;
        }
        // Generate downloadable data URL
        if (canvasRef.current) {
          setDataUrl(canvasRef.current.toDataURL('image/png'));
        }
      });
    }).catch(() => {
      setError(true);
    });
  }, [url, size, fgColor, bgColor]);

  if (error) {
    return (
      <div style={{
        width: size, height: size,
        background: 'var(--surface-3)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.8rem', color: 'var(--grey-400)'
      }}>
        QR Error
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
      <div style={{
        background: bgColor,
        padding: 12,
        borderRadius: 'var(--radius-lg)',
        display: 'inline-block',
        boxShadow: '0 0 20px rgba(0,196,188,0.15)',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: size, height: size }} />
      </div>
      {dataUrl && (
        <a
          href={dataUrl}
          download="storefront-qr-code.png"
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', textAlign: 'center' }}
        >
          Download QR Code PNG
        </a>
      )}
    </div>
  );
}
