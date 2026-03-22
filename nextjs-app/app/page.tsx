import type { Metadata } from 'next';
import MainContent from '@/components/MainContent';
import { getVisibleCards } from '@/lib/data';
import { getWeatherData } from '@/lib/weather';

export const metadata: Metadata = {
  title: 'yusteven',
  description: '实时监控系统日志和图像查看器。包含常规日志、错误日志查看功能, 舒曼共振 SHM、SRF、SRA实时监控图像显示, ECMWF欧洲气象局天气预报, 支持触摸屏和桌面设备操作。',
  keywords: '舒曼共振, SHM, SRF, SRA, sosrff, 天气预报, ECMWF',
  authors: [{ name: 'yusteven' }],
  other: {
    copyright: '© 2026 All rights reserved by yusteven',
  }
};

// 启用 ISR，每5分钟重新验证
export const revalidate = 300;

export default async function Home() {
  // 服务端预取数据
  const [weatherData, visibleCards] = await Promise.all([
    getWeatherData(),
    getVisibleCards()
  ]);

  return <MainContent initialWeatherData={weatherData} initialVisibleCards={visibleCards} />;
}

