'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface QRCodeGeneratorProps {
  url: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  /**
   * Pre-generated data URI from `agent_profiles.qr_code_data`. When present,
   * we render this as an <img> instead of regenerating client-side. The
   * brand-coloured server-side version is the source of truth.
   */
  qrCodeData?: string | null;
}

export default function QRCodeGenerator({
  url,
  size = 200,
  fgColor = '#C0B8A8',
  bgColor = '#FFFFFF',
  qrCodeData,
}: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState(false);

  // If the server already produced a brand-coloured QR data URI, render that
  // directly and skip the client-side qrcode pass.
  const usePreRendered = !!qrCodeData;

  useEffect(() => {
    if (usePreRendered) return;
    if (!url || !canvasRef.current) return;

    // Dynamic import of qrcode library (works client-side only)
    import('qrcode').then((QRCode) => {
      // Guard: component may have unmounted while the dynamic import was in flight.
      if (!canvasRef.current) return;

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
  }, [url, size, fgColor, bgColor, usePreRendered]);

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

  if (usePreRendered) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div style={{
          background: bgColor,
          padding: 12,
          borderRadius: 'var(--radius-lg)',
          display: 'inline-block',
          boxShadow: '0 0 20px rgba(192,184,168,0.15)',
        }}>
          <Image src={qrCodeData as string} alt="Storefront QR Code" width={size} height={size} unoptimized style={{ display: 'block', width: size, height: size }} />
        </div>
        <a
          href={qrCodeData as string}
          download="storefront-qr-code.png"
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', textAlign: 'center' }}
        >
          Download QR Code PNG
        </a>
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
        boxShadow: '0 0 20px rgba(192,184,168,0.15)',
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
