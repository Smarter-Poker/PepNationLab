import type { NextConfig } from "next";

const nextConfig = {
  // Barrel-file optimization: only pull the modules actually used from these
  // large packages into each route's bundle instead of the whole index. Biggest
  // win is lucide-react (imported by 127 files) plus the chart/animation libs.
  // Zero behavior change - purely a bundler transform.
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts', 'sonner'],
  },
  images: {
    // Allow next/image to optimize Supabase-storage assets. The homepage
    // landing artwork is a 2.0MB source PNG served from Supabase storage;
    // routing it through the image optimizer serves a right-sized AVIF/WebP
    // instead (measured LCP 15.9s -> target <2.5s). Scoped to the public
    // storage path of the PepNationLab project only.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ydsaqnnuwyvtyxgvrnys.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Signed URLs for the now-private messenger_media bucket. media_url is
        // re-signed at read time by lib/messenger/signMedia.ts into
        // /object/sign/ URLs. MessageBubble renders these with `unoptimized`
        // today, but allowlisting the path keeps them working if anyone later
        // removes that flag and routes them through the image optimizer.
        protocol: "https",
        hostname: "ydsaqnnuwyvtyxgvrnys.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // Quality allowlist. Every quality={n} used anywhere in the app MUST be
    // listed here - with an explicit qualities config, next/image rejects
    // unlisted values at request time (broken image, HTTP 400 from the
    // optimizer). Current call sites: 40 (landing artwork), 45 (city hero),
    // 60/75 (general use). If you change a quality prop, update this list.
    qualities: [40, 45, 60, 75],
    // Cache optimized images at the CDN/optimizer for 31 days instead of the
    // short default. Source images here are immutable content-addressed
    // assets, so long TTL = fewer re-optimizations and faster repeat LCP.
    minimumCacheTTL: 2678400,
  },
  async redirects() {
    // Bare/vanity city-slug redirects (e.g. /oaklawn or /oak-lawn ->
    // /peptides/illinois/oak-lawn), generated from lib/cities/cities-data.ts.
    // Applied at the edge BEFORE routing, so they work regardless of the
    // [agentSlug] serverless route (whose runtime city-match fallback proved
    // unreliable). Agent slugs and reserved routes have zero collisions.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cityRedirects = require("./lib/cities/city-redirects.cjs");
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "pepnationlabs.com" }],
        destination: "https://pepnationlab.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.pepnationlabs.com" }],
        destination: "https://pepnationlab.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.pepnationlab.com" }],
        destination: "https://pepnationlab.com/:path*",
        permanent: true,
      },
      {
        source: "/account/wishlist",
        destination: "/account/lab-journal",
        permanent: true,
      },
      {
        source: "/account/recently-viewed",
        destination: "/account/lab-journal",
        permanent: true,
      },
      ...cityRedirects,
    ];
  },
  async rewrites() {
    return [
      {
        source: "/hub/MLB-ANALYTICS-ENGINE/:path*",
        destination: "https://mlb-analytics-engine.vercel.app/:path*",
      },
      {
        // Sixteen research pages set twitter.images to /images/og-card.jpg,
        // which has never existed (the real asset is /og-card.png). Twitter
        // only falls back to og:image when twitter:image is ABSENT -- a present
        // but 404ing twitter:image means those pages share with no preview
        // image at all. Serving the real card at the legacy path fixes every
        // reference at once, and keeps working if a new page copies the old URL.
        source: "/images/og-card.jpg",
        destination: "/og-card.png",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/((?!api/proxy).*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // microphone=(self) is required for VoiceRecorder (getUserMedia({ audio: true })).
            // camera=() remains blocked — no video calling in-browser (calls use LiveKit server-side).
            value: "camera=(), microphone=(self), geolocation=()",
          },
          // Cross-origin isolation / XS-Leak hardening. same-origin-allow-popups
          // keeps any future OAuth/popup flow working while severing the
          // window.opener reference for cross-origin popups.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // Block Adobe/Flash-era cross-domain policy file abuse.
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          // Do not leak browsing intent via speculative DNS prefetch.
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Content-Security-Policy",
            value:
              // img-src: wildcard *.supabase.co covers all project IDs (storage, avatars).
              // media-src: blob: needed for VoiceRecorder (local audio blobs) and video playback.
              // connect-src: *.livekit.cloud covers LiveKit WebSocket for voice/video calls.
              "default-src 'self'; " +
              "img-src 'self' data: blob: https://*.supabase.co https://api.dicebear.com https://media.tenor.com; " +
              "media-src 'self' blob: https://*.supabase.co; " +
              // 'unsafe-eval' removed: audited all production client libs
              // (mermaid, recharts, framer-motion, zustand, qrcode, livekit) —
              // none call eval/new Function at runtime. 'unsafe-inline' stays
              // for now because the app ships inline <style>/JSON-LD blocks that
              // would need nonces/hashes before it can be dropped.
              "script-src 'self' 'unsafe-inline'; " +
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' data: https://fonts.gstatic.com; " +
              "connect-src 'self' https://*.supabase.co https://easypost-files.s3.us-west-2.amazonaws.com https://easypost-files.s3-us-west-2.amazonaws.com wss://*.supabase.co " +
                "wss://*.livekit.cloud https://*.livekit.cloud " +
                "https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io; " +
              "worker-src 'self' blob:; " +
              // object-src 'none': block Flash/Java-era plugin embeds entirely.
              "object-src 'none'; " +
              // base-uri 'self': prevent <base> tag injection from redirecting
              // every relative URL (forms, scripts) to an attacker host.
              "base-uri 'self'; " +
              // form-action 'self': forms can only submit back to us — blocks
              // XSS-injected <form action=\"https://evil\"> credential exfil.
              "form-action 'self'; " +
              "frame-ancestors 'none'; " +
              // Auto-upgrade any stray http:// subresource to https.
              "upgrade-insecure-requests;",
          },
        ],
      },
      // Static-asset cache policy. The public/ filenames below are
      // content-stable but NOT content-hashed, so they are deliberately NOT
      // immutable - stale-while-revalidate lets an updated asset propagate
      // within a day. sw.js is pinned to must-revalidate so clients never
      // strand on an old service worker.
      {
        source: "/logo.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/logo-mark.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/payment-logos/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/sw-register.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
  // R33: removed the `eslint: { ignoreDuringBuilds: true }` block. Next 16
  // dropped support for the eslint key in next.config; it now logs
  // "`eslint` configuration in next.config.ts is no longer supported" on
  // every build. Lint is configured via `npm run lint` (eslint.config.mjs)
  // and the Vercel build doesn't run lint anyway, so this block was dead
  // weight that only produced noise.
  typescript: {
    ignoreBuildErrors: true,
  },
};

// Wrap with Sentry only when @sentry/nextjs is resolvable. This keeps the
// build green in environments that haven't installed Sentry yet (e.g. a fresh
// clone before `npm install` has resolved the new dependency).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exported: any = nextConfig;
try {
  // Resolve via a variable so TS does not require the .d.ts to be present.
  const mod = '@sentry/nextjs';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withSentryConfig } = require(mod);
  exported = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Required for readable stack traces: uploads source maps when
    // SENTRY_AUTH_TOKEN is provisioned (no-op otherwise).
    authToken: process.env.SENTRY_AUTH_TOKEN,
    widenClientFileUpload: true,
    // First-party route for browser events so ad blockers do not eat
    // client-side error reports.
    tunnelRoute: '/monitoring',
  });
} catch {
  // Sentry not installed yet; ship without it.
}

export default exported;
