/** @type {import('next').NextConfig} */
const nextConfig = {
  // 开发模式：自动显示所有侧边栏卡片（无需检查日志文件）
  env: {
    NEXT_PUBLIC_DEV_MODE: process.env.NODE_ENV === 'development' ? 'true' : 'false',
  },

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

  // 3. 响应头配置：限制首页缓存时间，防止 Cloudflare 长期缓存错误内容
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 's-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },

  async rewrites() {
    const backendHost =
      process.env.NODE_ENV === 'development'
        ? 'localhost:3001'
        : 'localhost:3001';

    return [
      // 天气 API 代理
      {
        source: '/api/weather/:path*',
        destination: `http://${backendHost}/api/weather/:path*`,
      },
      // 图像 API 代理
      {
        source: '/api/image/:path*',
        destination: 'http://localhost:3002/api/image/:path*',
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