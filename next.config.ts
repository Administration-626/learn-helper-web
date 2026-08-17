import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
