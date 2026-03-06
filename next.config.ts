import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: false,
  // 启用 standalone 输出模式以优化 Docker 部署
  output: 'standalone',
};

export default nextConfig;
