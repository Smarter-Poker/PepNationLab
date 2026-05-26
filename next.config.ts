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
};

export default nextConfig;
