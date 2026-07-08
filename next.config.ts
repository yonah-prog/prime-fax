import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverBodySizeLimit: false,
  },
};

export default nextConfig;
