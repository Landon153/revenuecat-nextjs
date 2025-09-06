import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/webhook_handler',
        destination: '/api/main',  // removed 'pages' from the path
      },
    ];
  },
};

export default nextConfig;
