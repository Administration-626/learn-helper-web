import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/banks',
        destination: '/bank',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
