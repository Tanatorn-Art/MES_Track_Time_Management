import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow serving static files from the config folder
  async rewrites() {
    return [
      {
        source: '/config/:path*',
        destination: '/api/serve-config/:path*',
      },
    ];
  },
};

export default nextConfig;
