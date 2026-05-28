import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // pepnationlabs.com ->pepnationlab.com (301 permanent)
      {
        source: "/:path*",
        has: [{ type: "host", value: "pepnationlabs.com" }],
        destination: "https://pepnationlab.com/:path*",
        permanent: true,
      },
      // www.pepnationlabs.com ->pepnationlab.com (301 permanent)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.pepnationlabs.com" }],
        destination: "https://pepnationlab.com/:path*",
        permanent: true,
      },
      // www.pepnationlab.com ->pepnationlab.com (301 permanent)
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
            value: "camera=(), microphone=(), geolocation=()",
          },
          // CSP — start permissive and ratchet down. Allow self + Supabase + Vercel.
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; img-src 'self' data: https://ydsaqnnuwyvtyxgvrnys.supabase.co https://api.dicebear.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://api.shippo.com wss://*.supabase.co; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
