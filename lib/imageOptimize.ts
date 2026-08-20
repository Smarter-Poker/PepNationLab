/**
 * Thumbnail optimizer for raw <img> tags.
 *
 * WHY THIS EXISTS
 * ---------------
 * The storefront product-detail view is the only place in the app that renders
 * the ORIGINAL vial artwork through plain <img> tags instead of <Image>. Those
 * originals are big:
 *
 *   public/images/products/*.png        186 files,  99 MB  (1024x1024 / 848x1264)
 *   public/images/savage-brands/*.png   258 files,  95 MB  (1024x512)
 *   public/images/vial_*.png            ~500 KB each        (1024x1024)
 *
 * A single detail view paints 15-20 of them at once (main vial + Supplies You
 * Need + What's Inside This Stack + Similar Products). At ~4 bytes per pixel
 * that is 40-80 MB of DECODED bitmap in one view, on top of the storefront grid
 * that is still mounted behind `display:none`.
 *
 * Desktop has the headroom and renders fine. Mobile Safari / Chrome-Android
 * enforce a per-tab image-decode budget; once it is blown the browser silently
 * drops the decodes and paints EMPTY boxes -- which is exactly the "every vial
 * is a blank vial, but only on mobile" bug. The catalog grid escapes it because
 * it renders one right-sized <Image> composite card per product and never
 * touches these originals.
 *
 * The fix is to stop shipping 1024px source art for a 48px or 80px thumbnail.
 * `optimizedImageSrc` rewrites a local image path to the Next.js image
 * optimizer, which serves a right-sized AVIF/WebP instead. An 80px thumb drops
 * from ~4 MB decoded to ~0.26 MB -- roughly a 99% cut across the view.
 *
 * Use this ONLY for raw <img>. Anything rendering <Image> without `unoptimized`
 * already goes through the optimizer.
 */

// Widths the Next.js optimizer will accept = images.deviceSizes ++
// images.imageSizes. next.config.ts does not override either, so these are the
// framework defaults. Requesting any other width returns HTTP 400 (a broken
// image), so ALWAYS snap to this list.
const NEXT_IMAGE_WIDTHS = [
  16, 32, 48, 64, 96, 128, 256, 384,
  640, 750, 828, 1080, 1200, 1920, 2048, 3840,
] as const;

// Must stay in sync with `images.qualities` in next.config.ts. An unlisted
// quality is rejected at request time.
const ALLOWED_QUALITIES = [40, 45, 60, 75];

// The only remote host next.config.ts allowlists in images.remotePatterns.
const OPTIMIZABLE_REMOTE_HOST = 'ydsaqnnuwyvtyxgvrnys.supabase.co';

/**
 * Rewrite an image URL to a right-sized Next.js optimizer URL.
 *
 * @param src            Original image URL. May be relative ("/images/...") or
 *                       an absolute URL on the allowlisted Supabase host.
 * @param displayWidth   CSS pixel width the image is painted at. The helper
 *                       requests roughly 2x this for retina and snaps up to the
 *                       nearest optimizer-legal width.
 * @param quality        60 by default. Must be in next.config.ts images.qualities.
 *
 * Returns `src` unchanged when it cannot safely be optimized (empty, data/blob
 * URI, SVG, or a remote host that is not allowlisted). Callers should still
 * keep an onError fallback -- see the call sites.
 */
export function optimizedImageSrc(
  src: string | null | undefined,
  displayWidth: number,
  quality = 60
): string {
  if (!src) return '';

  const trimmed = src.trim();
  if (!trimmed) return '';

  // Already-optimized, inline, or vector sources are passed through untouched.
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('/_next/image')) return trimmed;
  if (trimmed.split('?')[0].toLowerCase().endsWith('.svg')) return trimmed;

  // Absolute URLs are only optimizable on the allowlisted Supabase host.
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes(OPTIMIZABLE_REMOTE_HOST)) {
    return trimmed;
  }

  // Protocol-relative and other exotic forms: leave alone.
  if (trimmed.startsWith('//')) return trimmed;
  if (!trimmed.startsWith('/') && !/^https?:\/\//i.test(trimmed)) return trimmed;

  const target = Math.max(1, Math.round(displayWidth * 2));
  const width =
    NEXT_IMAGE_WIDTHS.find((w) => w >= target) ??
    NEXT_IMAGE_WIDTHS[NEXT_IMAGE_WIDTHS.length - 1];

  const q = ALLOWED_QUALITIES.includes(quality) ? quality : 60;

  return `/_next/image?url=${encodeURIComponent(trimmed)}&w=${width}&q=${q}`;
}

/**
 * onError handler factory for an optimized <img>.
 *
 * Recovery ladder, in order:
 *   1. optimizer URL failed  -> retry the untouched original
 *   2. original failed       -> fall back to the shared clear-vial placeholder
 *   3. placeholder failed    -> give up (no infinite error loop)
 */
export function makeImageErrorHandler(originalSrc: string, placeholder = '/images/peptide_clear.png') {
  return (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const el = e.currentTarget;
    if (el.dataset.pnlFallback === 'done') return;

    if (el.src.includes('/_next/image') && originalSrc) {
      el.dataset.pnlFallback = 'original';
      el.srcset = '';
      el.src = originalSrc;
      return;
    }

    el.dataset.pnlFallback = 'done';
    if (!el.src.includes(placeholder)) {
      el.srcset = '';
      el.src = placeholder;
    }
  };
}
