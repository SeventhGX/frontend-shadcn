import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: false,
  // 启用 standalone 输出模式以优化 Docker 部署
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL || 'http://app_backend:8000'}/:path*`,
      },
    ]
  },
};

export default nextConfig;
