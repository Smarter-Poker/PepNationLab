import type { NextConfig } from "next";

const nextConfig = {
  async redirects() {
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
    ];
  },
  async rewrites() {
    return [
      {
        source: "/hub/MLB-ANALYTICS/:path*",
        destination: "https://mlb-analytics-engine.vercel.app/:path*",
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' data: https://fonts.gstatic.com; " +
              "connect-src 'self' https://*.supabase.co https://api.goshippo.com wss://*.supabase.co " +
                "wss://*.livekit.cloud https://*.livekit.cloud " +
                "https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io; " +
              "worker-src 'self' blob:; " +
              "frame-ancestors 'none';",
          },
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
  });
} catch {
  // Sentry not installed yet; ship without it.
}

export default exported;
