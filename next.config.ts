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
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
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
  eslint: {
    ignoreDuringBuilds: true,
  },
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
