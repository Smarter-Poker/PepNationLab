import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pep Nation Lab',
    short_name: 'PNL',
    description: 'Premium Research Peptide Distribution',
    // Stable app id + self-reference so navigator.getInstalledRelatedApps() can
    // report whether THIS PWA is already installed on the device (used by the
    // install prompt to avoid offering an install the user already has).
    id: '/',
    related_applications: [
      { platform: 'webapp', url: 'https://pepnationlab.com/manifest.webmanifest' },
    ],
    start_url: '/',
    display: 'standalone',
    background_color: '#0A1018',
    theme_color: '#0A1018',
    orientation: 'portrait-primary',
    icons: [
      // Raster icons first: iOS and Lighthouse PWA installability ignore
      // SVG-only manifests. PNGs generated from logo-mark.svg on brand black.
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/logo-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
