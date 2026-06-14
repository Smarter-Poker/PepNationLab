'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Avatar from '@/components/messenger/Avatar';

interface Props {
  currentAvatarUrl: string | null;
  name: string;
  onUploadSuccess?: (url: string) => void;
}

const OUTPUT_SIZE = 512; // Final square avatar resolution in pixels
const MAX_ZOOM = 4;

export default function AvatarUpload({ currentAvatarUrl, name, onUploadSuccess }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File Is Too Large. Max Size Is 5MB.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Invalid File Type. Please Upload A JPG, PNG, WEBP, Or GIF.');
      return;
    }

    setError(null);
    // Open the framing tool instead of uploading the raw file immediately
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);

    // Allow re-selecting the same file later
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeCropper = useCallback(() => {
    setCropSrc((prev) => {
      if (prev) {
        setTimeout(() => URL.revokeObjectURL(prev), 1000);
      }
      return null;
    });
  }, []);

  const handleCropConfirm = async (blob: Blob) => {
    setError(null);
    setUploading(true);

    const croppedUrl = URL.createObjectURL(blob);
    setPreview(croppedUrl);
    closeCropper();

    try {
      const formData = new FormData();
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      formData.append('file', file);

      const res = await fetch('/api/account/avatar', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload Failed');

      if (onUploadSuccess) {
        onUploadSuccess(json.avatar_url);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed To Upload Image.');
      setPreview(currentAvatarUrl); // Revert preview on failure
    } finally {
      setUploading(false);
      setTimeout(() => URL.revokeObjectURL(croppedUrl), 1000);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          position: 'relative',
          cursor: uploading ? 'wait' : 'pointer',
          borderRadius: '50%',
          overflow: 'hidden',
          width: 80,
          height: 80,
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <Avatar name={name} avatarUrl={preview} size={80} />

        {/* Hover Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
            ...(uploading ? { opacity: 0.7 } : {}),
          }}
          onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.opacity = '0'; }}
        >
          {uploading ? (
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          )}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--white)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: uploading ? 'wait' : 'pointer',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            {uploading ? 'Uploading...' : 'Upload Picture'}
          </button>
          {onUploadSuccess && (
            <button
              onClick={() => onUploadSuccess('default')}
              disabled={uploading}
              style={{
                background: 'transparent',
                color: 'var(--silver, rgba(192,184,168,0.65))',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: uploading ? 'wait' : 'pointer',
                opacity: uploading ? 0.5 : 1,
              }}
            >
              Use Default
            </button>
          )}
        </div>
        <div style={{ color: 'var(--silver, rgba(192,184,168,0.65))', fontSize: '0.7rem', marginTop: 6 }}>
          JPG, PNG, WEBP, Or GIF. Max 5MB.
        </div>
        {error && (
          <div style={{ color: '#E53E3E', fontSize: '0.75rem', marginTop: 4 }}>
            {error}
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          busy={uploading}
          onCancel={closeCropper}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

interface CropperProps {
  src: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

function AvatarCropper({ src, busy, onCancel, onConfirm }: CropperProps) {
  // Square framing viewport size in CSS pixels (responsive to small screens)
  const [viewport, setViewport] = useState(300);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // Top-left of image within viewport
  const [rendering, setRendering] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; zoom: number; midX: number; midY: number } | null>(null);

  // Scale at which the image just covers the viewport (zoom = 1)
  const baseScale = nat ? Math.max(viewport / nat.w, viewport / nat.h) : 1;

  const clampPos = useCallback(
    (x: number, y: number, z: number) => {
      if (!nat) return { x, y };
      const dispW = nat.w * baseScale * z;
      const dispH = nat.h * baseScale * z;
      const minX = viewport - dispW;
      const minY = viewport - dispH;
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y)),
      };
    },
    [nat, baseScale, viewport]
  );

  // Decide viewport size once on mount (client only)
  useEffect(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 360;
    setViewport(Math.max(220, Math.min(320, w - 48)));
  }, []);

  // Load the image and center it in the frame
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (!nat) return;
    const dispW = nat.w * baseScale;
    const dispH = nat.h * baseScale;
    setZoom(1);
    setPos({ x: (viewport - dispW) / 2, y: (viewport - dispH) / 2 });
  }, [nat, baseScale, viewport]);

  // Lock background scroll while the cropper is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const applyZoomAtPoint = useCallback(
    (newZoom: number, anchorX: number, anchorY: number) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, newZoom));
      setPos((p) => {
        const scaleOld = baseScale * zoom;
        const scaleNew = baseScale * z;
        const srcX = (anchorX - p.x) / scaleOld;
        const srcY = (anchorY - p.y) / scaleOld;
        const nx = anchorX - srcX * scaleNew;
        const ny = anchorY - srcY * scaleNew;
        return clampPos(nx, ny, z);
      });
      setZoom(z);
    },
    [baseScale, zoom, clampPos]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const rect = surfaceRef.current?.getBoundingClientRect();
      pinch.current = {
        dist: Math.hypot(dx, dy),
        zoom,
        midX: (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0),
        midY: (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0),
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const pts = Array.from(pointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / (pinch.current.dist || 1);
      applyZoomAtPoint(pinch.current.zoom * ratio, pinch.current.midX, pinch.current.midY);
      return;
    }

    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setPos((p) => clampPos(p.x + dx, p.y + dy, zoom));
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const ax = e.clientX - (rect?.left ?? 0);
    const ay = e.clientY - (rect?.top ?? 0);
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    applyZoomAtPoint(zoom * factor, ax, ay);
  };

  const handleSave = () => {
    const img = imgRef.current;
    if (!img || !nat) return;
    setRendering(true);
    try {
      const scaleTotal = baseScale * zoom;
      const sSize = viewport / scaleTotal;
      const sx = -pos.x / scaleTotal;
      const sy = -pos.y / scaleTotal;

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setRendering(false);
        return;
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      canvas.toBlob(
        (blob) => {
          setRendering(false);
          if (blob) onConfirm(blob);
        },
        'image/jpeg',
        0.9
      );
    } catch (err) {
      console.error(err);
      setRendering(false);
    }
  };

  const dispW = nat ? nat.w * baseScale * zoom : 0;
  const dispH = nat ? nat.h * baseScale * zoom : 0;
  const working = busy || rendering;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(5,10,15,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        height: '100dvh',
      }}
    >
      <div style={{ color: 'var(--white, #fff)', fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>
        Frame Your Photo
      </div>
      <div style={{ color: 'var(--silver, rgba(192,184,168,0.7))', fontSize: '0.78rem', marginBottom: 18, textAlign: 'center' }}>
        Drag To Reposition. Pinch Or Scroll To Zoom.
      </div>

      <div
        ref={surfaceRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
        style={{
          position: 'relative',
          width: viewport,
          height: viewport,
          borderRadius: '50%',
          overflow: 'hidden',
          touchAction: 'none',
          cursor: 'grab',
          background: '#0F1923',
          userSelect: 'none',
        }}
      >
        {nat && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Crop Preview"
            draggable={false}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: dispW,
              height: dispH,
              maxWidth: 'none',
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Circular framing ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.85)',
            boxShadow: '0 0 0 9999px rgba(5,10,15,0.55)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Zoom control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, width: viewport, maxWidth: 320 }}>
        <span style={{ color: 'var(--silver, rgba(192,184,168,0.7))', fontSize: '0.7rem', fontWeight: 600 }}>Zoom</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => applyZoomAtPoint(parseFloat(e.target.value), viewport / 2, viewport / 2)}
          disabled={!nat || working}
          style={{ flex: 1, accentColor: 'var(--teal, #00C4BC)' }}
          aria-label="Zoom"
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          onClick={onCancel}
          disabled={working}
          style={{
            background: 'transparent',
            color: 'var(--silver, rgba(192,184,168,0.8))',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 10,
            padding: '10px 22px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: working ? 'wait' : 'pointer',
            opacity: working ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!nat || working}
          style={{
            background: 'var(--teal, #00C4BC)',
            color: '#04201F',
            border: 'none',
            borderRadius: 10,
            padding: '10px 26px',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: !nat || working ? 'wait' : 'pointer',
            opacity: !nat || working ? 0.6 : 1,
          }}
        >
          {working ? 'Saving...' : 'Save Photo'}
        </button>
      </div>
    </div>
  );
}
