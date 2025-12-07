export interface TimeSlot {
    key: string;
    hours: number;
    url: string;
    info: any;
}

// 统一的环境变量处理
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.yusteven.com';
const API_ENDPOINT = `${BACKEND_URL}/api/weather/all`;

// ✅ 1. 抽离纯解析逻辑
export function parseWeatherData(rawData: any): TimeSlot[] {
    if (!rawData || !rawData.data) return [];

    const slots: TimeSlot[] = [];
    for (const [key, value] of Object.entries(rawData.data)) {
        const v = value as any;
        if (v?.data?.link?.href) {
            const hours = parseInt(key.substring(1));
            slots.push({
                key: key,
                hours: hours,
                url: v.data.link.href,
                info: v.data.attributes
            });
        }
    }
    // 按时间排序
    return slots.sort((a, b) => a.hours - b.hours);
}

// 服务端获取函数
export async function getWeatherData(): Promise<TimeSlot[]> {
    try {
        const response = await fetch(API_ENDPOINT, {
            next: { revalidate: 300 }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        // ✅ 复用解析逻辑
        return parseWeatherData(result);
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return [];
    }
}
