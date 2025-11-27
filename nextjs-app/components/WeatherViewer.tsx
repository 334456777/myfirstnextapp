'use client';

import { FC } from 'react';
import useSWR from 'swr';
import ImageGallery, { ImageItem } from './ImageGallery';
import { TimeSlot } from '@/lib/weather';

interface WeatherViewerProps {
    initialData?: TimeSlot[];
}

const BACKEND_URL = 'https://www.yusteven.com';
const API_ENDPOINT = `${BACKEND_URL}/api/weather/all`;

// SWR fetcher 函数
const fetcher = async (url: string): Promise<TimeSlot[]> => {
    const response = await fetch(url);
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
};

const WeatherViewer: FC<WeatherViewerProps> = ({ initialData }) => {
    // 使用 SWR 进行数据获取和缓存，使用服务端预取的数据作为初始值
    const { data: timeSlots, error, isLoading } = useSWR(
        API_ENDPOINT,
        fetcher,
        {
            fallbackData: initialData, // 使用服务端预取数据作为初始值
            refreshInterval: 5 * 60 * 1000,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            dedupingInterval: 5 * 60 * 1000,
            errorRetryCount: 3,
            errorRetryInterval: 5000,
        }
    );

    // 将天气数据转换为 ImageItem 格式
    const images: ImageItem[] = timeSlots?.map(slot => {
        const forecastTime = slot.info?.forecastTime || '';
        const labelText = forecastTime
            ? `${slot.hours}h later (${forecastTime})`
            : `${slot.hours}h later`;

        return {
            key: slot.key,
            url: slot.url,
            alt: `${slot.hours}h weather`,
            label: labelText,
            width: 2000,   // ECMWF 天气图标准尺寸
            height: 1800,  // ECMWF 天气图标准尺寸
        };
    }) || [];

    return (
        <ImageGallery
            images={images}
            loading={isLoading && !initialData}
            error={error?.message || null}
            loadingMessage="Fetching weather images..."
            emptyMessage="No weather data available"
            minScreenSizeForZoom={1024}
            columns={{ mobile: 1, tablet: 1, desktop: 2, wide: 3 }}
        />
    );
};

export default WeatherViewer;
