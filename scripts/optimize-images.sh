#!/usr/bin/env bash
#
# optimize-images.sh — crush PepNationLab's public PNGs in place.
#
# WHY: public/images is ~131 MB across ~210 PNGs (dozens of 2+ MB research-area,
# dashboard, and hero images). 182 of 189 <Image> tags use `unoptimized`, so
# Next.js serves these raw — they are the single biggest first-load weight on
# the research/areas/dashboard pages. The service worker now 7-day-caches images
# so repeat visits are already cheap, but the cold-load cost is large.
#
# WHAT: re-encodes every PNG in place (SAME filename, SAME .png format) with
# pngquant (lossy palette) so NO source code changes are needed — every existing
# reference keeps working, the files are just much smaller (typically 50-70%).
# Falls back to ImageMagick if pngquant is missing. Skips files that don't shrink.
#
# HOW TO RUN (from the repo root, on your machine):
#   bash scripts/optimize-images.sh           # optimize
#   git add public/images && git commit -m "perf: compress public PNGs in place"
#   git push                                  # Vercel auto-deploys
#
# Review a few images visually before committing. Re-run any time new images are
# added. For an even bigger win later, convert heroes/backgrounds to WebP/AVIF —
# but that requires updating the references, so it is a separate, deliberate task.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/public/images"
QUALITY="60-85"   # pngquant quality window; raise the floor if you see banding

if [ ! -d "$DIR" ]; then
  echo "ERROR: $DIR not found. Run from the repo root." >&2
  exit 1
fi

have() { command -v "$1" >/dev/null 2>&1; }

if have pngquant; then
  TOOL="pngquant"
elif have convert; then
  TOOL="imagemagick"
else
  echo "ERROR: install pngquant (preferred) or ImageMagick first:" >&2
  echo "  macOS:  brew install pngquant" >&2
  echo "  Ubuntu: sudo apt-get install -y pngquant" >&2
  exit 1
fi

echo "Tool: $TOOL"
echo "Scanning $DIR ..."

before_total=0
after_total=0
optimized=0
skipped=0

while IFS= read -r -d '' f; do
  before=$(wc -c < "$f")
  tmp="$(mktemp).png"

  if [ "$TOOL" = "pngquant" ]; then
    # --skip-if-larger keeps the original when it can't beat it
    if ! pngquant --quality="$QUALITY" --strip --force --skip-if-larger \
        --output "$tmp" -- "$f" 2>/dev/null; then
      rm -f "$tmp"; skipped=$((skipped+1)); before_total=$((before_total+before)); after_total=$((after_total+before)); continue
    fi
  else
    # ImageMagick fallback: strip metadata + max compression
    convert "$f" -strip -define png:compression-level=9 "$tmp" 2>/dev/null || { rm -f "$tmp"; skipped=$((skipped+1)); before_total=$((before_total+before)); after_total=$((after_total+before)); continue; }
  fi

  after=$(wc -c < "$tmp" 2>/dev/null || echo "$before")
  if [ "$after" -gt 0 ] && [ "$after" -lt "$before" ]; then
    mv "$tmp" "$f"
    optimized=$((optimized+1))
    after_total=$((after_total+after))
    printf "  %-55s %5d KB -> %5d KB\n" "${f#"$DIR"/}" $((before/1024)) $((after/1024))
  else
    rm -f "$tmp"
    skipped=$((skipped+1))
    after_total=$((after_total+before))
  fi
  before_total=$((before_total+before))
done < <(find "$DIR" -type f -iname '*.png' -print0)

echo ""
echo "Optimized: $optimized   Skipped (no gain): $skipped"
printf "Total: %d MB -> %d MB  (saved %d MB)\n" \
  $((before_total/1024/1024)) $((after_total/1024/1024)) $(((before_total-after_total)/1024/1024))
echo ""
echo "Next: git add public/images && git commit -m 'perf: compress public PNGs in place' && git push"
