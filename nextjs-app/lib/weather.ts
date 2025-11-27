// 服务端天气数据获取函数
export interface TimeSlot {
    key: string;
    hours: number;
    url: string;
    info: any;
}

const BACKEND_URL = 'https://www.yusteven.com';
const API_ENDPOINT = `${BACKEND_URL}/api/weather/all`;

export async function getWeatherData(): Promise<TimeSlot[]> {
    try {
        const response = await fetch(API_ENDPOINT, {
            next: { revalidate: 300 } // ISR: 5分钟重新验证
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success || !result.data) {
            throw new Error('Invalid data format');
        }

        const slots: TimeSlot[] = [];
        for (const [key, value] of Object.entries(result.data)) {
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

        slots.sort((a, b) => a.hours - b.hours);
        return slots;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return [];
    }
}
