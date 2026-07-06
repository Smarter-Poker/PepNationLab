'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '@/components/messenger/Avatar';

interface Props {
  currentAvatarUrl: string | null;
  name: string;
  onUploadSuccess?: (url: string) => void;
}

const OUTPUT_SIZE = 512; // Final square avatar resolution in pixels
const MAX_ZOOM = 4;
const TAP_MOVE_TOLERANCE = 8; // px of movement still counted as a tap
const TAP_MAX_MS = 300; // max press duration counted as a tap
const DOUBLE_TAP_MS = 300; // max gap between taps for a double tap
const DOUBLE_TAP_ZOOM = 2.2;

export default function AvatarUpload({ currentAvatarUrl, name, onUploadSuccess }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
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
    setCropFile(file);

    // Allow re-selecting the same file later
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeCropper = useCallback(() => setCropFile(null), []);

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

  // Reset to the default avatar (initials). Persists the reset server-side so it
  // survives a reload, then updates parent state.
  const handleUseDefault = async () => {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch('/api/account/avatar', { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed To Reset Photo.');
      }
      setPreview(null);
      if (onUploadSuccess) onUploadSuccess('default');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed To Reset Photo.');
    } finally {
      setUploading(false);
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
              onClick={handleUseDefault}
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

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          busy={uploading}
          onCancel={closeCropper}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

interface CropperProps {
  file: File;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

type ImageSource = ImageBitmap | HTMLImageElement;

function sourceDims(src: ImageSource): { w: number; h: number } {
  const w = (src as HTMLImageElement).naturalWidth || (src as ImageBitmap).width;
  const h = (src as HTMLImageElement).naturalHeight || (src as ImageBitmap).height;
  return { w, h };
}

function AvatarCropper({ file, busy, onCancel, onConfirm }: CropperProps) {
  const [viewport, setViewport] = useState(300);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null); // rotated logical dims
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // Top-left of image within viewport
  const [rotation, setRotation] = useState(0); // 0 / 90 / 180 / 270
  const [rendering, setRendering] = useState(false);
  const [decoding, setDecoding] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const baseRef = useRef<ImageSource | null>(null); // orientation-corrected original
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null); // rotated source for output
  const previewUrlRef = useRef<string | null>(null);
  const fallbackUrlRef = useRef<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; zoom: number; midX: number; midY: number } | null>(null);
  const tap = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const lastTapAt = useRef(0);

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

  // Portal only after mount so document.body exists (avoids SSR mismatch)
  useEffect(() => setMounted(true), []);

  // Size the frame to BOTH screen width and height so it always fits
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const byHeight = h - 260; // reserve space for header + zoom + button rows
      setViewport(Math.max(200, Math.min(340, w - 40, byHeight)));
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, []);

  // Build the rotated working canvas + preview image for a given rotation
  const renderWork = useCallback((rot: number) => {
    const base = baseRef.current;
    if (!base) return;
    const { w: ow, h: oh } = sourceDims(base);
    const r = ((rot % 360) + 360) % 360;
    const swap = r === 90 || r === 270;
    const cw = swap ? oh : ow;
    const ch = swap ? ow : oh;

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((r * Math.PI) / 180);
    ctx.drawImage(base, -ow / 2, -oh / 2, ow, oh);
    workCanvasRef.current = canvas;

    setNat({ w: cw, h: ch });

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      },
      'image/jpeg',
      0.9
    );
  }, []);

  // Decode the file with EXIF orientation applied, with an <img> fallback
  useEffect(() => {
    let cancelled = false;
    setDecoding(true);
    setLoadError(null);

    const finish = (base: ImageSource) => {
      if (cancelled) {
        if ('close' in base) (base as ImageBitmap).close();
        return;
      }
      baseRef.current = base;
      setRotation(0);
      renderWork(0);
      setDecoding(false);
    };

    const handleImgFallback = () => {
      try {
        const url = URL.createObjectURL(file);
        fallbackUrlRef.current = url;
        const img = new Image();
        img.onload = () => finish(img);
        img.onerror = () => {
          if (!cancelled) {
            setLoadError("Couldn't Read This Photo. Please Choose A JPG Or PNG.");
            setDecoding(false);
          }
        };
        img.src = url;
      } catch {
        if (!cancelled) {
          setLoadError("Couldn't Read This Photo. Please Choose A JPG Or PNG.");
          setDecoding(false);
        }
      }
    };

    if (typeof createImageBitmap === 'function') {
      createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
        .then((bmp) => finish(bmp))
        .catch(() => handleImgFallback());
    } else {
      handleImgFallback();
    }

    return () => {
      cancelled = true;
      const base = baseRef.current;
      if (base && 'close' in base) (base as ImageBitmap).close();
      baseRef.current = null;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      if (fallbackUrlRef.current) {
        URL.revokeObjectURL(fallbackUrlRef.current);
        fallbackUrlRef.current = null;
      }
    };
  }, [file, renderWork]);

  // Recenter and reset zoom whenever the logical dimensions change
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

  // Move initial focus into the dialog for keyboard users
  useEffect(() => {
    if (mounted) dialogRef.current?.focus();
  }, [mounted]);

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
    if (!nat) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      tap.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
    } else if (pointers.current.size === 2) {
      tap.current = null;
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
    if (!nat || !pointers.current.has(e.pointerId)) return;
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
      if (tap.current) {
        const movedBy = Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y);
        if (movedBy > TAP_MOVE_TOLERANCE) tap.current.moved = true;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setPos((p) => clampPos(p.x + dx, p.y + dy, zoom));
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    const wasLast = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;

    // Double-tap to zoom toggle
    if (wasLast && tap.current && !tap.current.moved && Date.now() - tap.current.t < TAP_MAX_MS) {
      const now = Date.now();
      if (now - lastTapAt.current < DOUBLE_TAP_MS) {
        const rect = surfaceRef.current?.getBoundingClientRect();
        const ax = e.clientX - (rect?.left ?? 0);
        const ay = e.clientY - (rect?.top ?? 0);
        applyZoomAtPoint(zoom > 1.05 ? 1 : DOUBLE_TAP_ZOOM, ax, ay);
        lastTapAt.current = 0;
      } else {
        lastTapAt.current = now;
      }
    }
    tap.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!nat) return;
    const rect = surfaceRef.current?.getBoundingClientRect();
    const ax = e.clientX - (rect?.left ?? 0);
    const ay = e.clientY - (rect?.top ?? 0);
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    applyZoomAtPoint(zoom * factor, ax, ay);
  };

  const handleRotate = () => {
    if (!baseRef.current) return;
    const next = (rotation + 90) % 360;
    setRotation(next);
    renderWork(next);
  };

  const handleReset = () => {
    if (!nat) return;
    const dispW = nat.w * baseScale;
    const dispH = nat.h * baseScale;
    setZoom(1);
    setPos({ x: (viewport - dispW) / 2, y: (viewport - dispH) / 2 });
  };

  const handleSave = () => {
    const src = workCanvasRef.current;
    if (!src || !nat) return;
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
      ctx.drawImage(src, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!working) onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const dispW = nat ? nat.w * baseScale * zoom : 0;
  const dispH = nat ? nat.h * baseScale * zoom : 0;
  const working = busy || rendering;
  const ready = !!nat && !!previewUrl && !decoding && !loadError;

  if (!mounted || typeof document === 'undefined') return null;

  const secondaryBtn = (label: string, onClick: () => void, disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        minHeight: 44,
        background: 'rgba(255,255,255,0.08)',
        color: 'var(--white, #fff)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 10,
        fontSize: '0.82rem',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );

  const overlay = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Frame Your Photo"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 2147483600,
        background: 'rgba(5,10,15,0.96)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        overflowY: 'auto',
        boxSizing: 'border-box',
        outline: 'none',
        paddingTop: 'max(20px, env(safe-area-inset-top))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        WebkitTapHighlightColor: 'transparent',
        overscrollBehavior: 'contain',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ color: 'var(--white, #fff)', fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>
          Frame Your Photo
        </div>
        <div style={{ color: 'var(--silver, rgba(192,184,168,0.7))', fontSize: '0.78rem', textAlign: 'center', maxWidth: 320 }}>
          Drag To Move. Pinch, Scroll, Or Double Tap To Zoom.
        </div>
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
          flexShrink: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          touchAction: 'none',
          cursor: ready ? 'grab' : 'default',
          background: '#0F1923',
          userSelect: 'none',
        }}
      >
        {previewUrl && !loadError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Crop Preview"
            draggable={false}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: dispW,
              height: dispH,
              maxWidth: 'none',
              maxHeight: 'none',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Loading spinner while the photo decodes */}
        {!ready && !loadError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
        )}

        {/* Unreadable photo message */}
        {loadError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: 'var(--silver, rgba(192,184,168,0.85))', fontSize: '0.8rem' }}>
            {loadError}
          </div>
        )}

        {/* Circular framing ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.85)',
            boxShadow: '0 0 0 9999px rgba(5,10,15,0.6)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Zoom control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: viewport, maxWidth: 340, flexShrink: 0 }}>
        <span style={{ color: 'var(--silver, rgba(192,184,168,0.7))', fontSize: '0.7rem', fontWeight: 600 }}>Zoom</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => applyZoomAtPoint(parseFloat(e.target.value), viewport / 2, viewport / 2)}
          disabled={!ready || working}
          style={{ flex: 1, height: 28, accentColor: 'var(--teal, #00C4BC)' }}
          aria-label="Zoom"
        />
      </div>

      {/* Rotate / Reset */}
      <div style={{ display: 'flex', gap: 12, flexShrink: 0, width: viewport, maxWidth: 340 }}>
        {secondaryBtn('Rotate', handleRotate, !ready || working)}
        {secondaryBtn('Reset', handleReset, !ready || working)}
      </div>

      {/* Cancel / Save */}
      <div style={{ display: 'flex', gap: 12, flexShrink: 0, width: viewport, maxWidth: 340 }}>
        <button
          onClick={onCancel}
          disabled={working}
          style={{
            flex: 1,
            minHeight: 48,
            background: 'transparent',
            color: 'var(--silver, rgba(192,184,168,0.85))',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 12,
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: working ? 'wait' : 'pointer',
            opacity: working ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!ready || working}
          style={{
            flex: 1,
            minHeight: 48,
            background: 'var(--teal, #00C4BC)',
            color: '#04201F',
            border: 'none',
            borderRadius: 12,
            fontSize: '0.9rem',
            fontWeight: 800,
            cursor: !ready || working ? 'not-allowed' : 'pointer',
            opacity: !ready || working ? 0.6 : 1,
          }}
        >
          {working ? 'Saving...' : 'Save Photo'}
        </button>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
