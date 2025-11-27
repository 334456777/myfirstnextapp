/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 明确指定项目根目录
  outputFileTracingRoot: __dirname,

  // 2.图片配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sos70.ru',
      },
      {
        protocol: 'https',
        hostname: 'www.yusteven.com',
      },
      {
        protocol: 'https',
        hostname: 'sosrff.s3.ap-northeast-1.amazonaws.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/image/:path*', // 匹配前端发出的所有 /api/image/ 开头的请求
        destination: 'http://localhost:3002/api/image/:path*', // 转发给后端服务
      },
    ];
  },

  // 4. 其他原有配置保持不变
  reactStrictMode: true,
  compress: true,
  experimental: {
    optimizePackageImports: ['photoswipe', 'react-photoswipe-gallery'],
  },
  allowedDevOrigins: ['www.yusteven.com'],
  poweredByHeader: false,
  output: 'standalone',
};

module.exports = nextConfig;
