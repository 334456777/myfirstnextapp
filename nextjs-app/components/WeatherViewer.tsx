'use client';

import { FC, useMemo } from 'react';
import useSWR from 'swr';
import ImageGallery, { ImageItem } from './ImageGallery';
import { TimeSlot, parseWeatherData } from '@/lib/weather';
import styles from './WeatherViewer.module.css';

interface WeatherViewerProps {
    initialData?: TimeSlot[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.yusteven.com';
const API_ENDPOINT = `${BACKEND_URL}/api/weather/all`;

const fetcher = async (url: string): Promise<TimeSlot[]> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather fetch failed');
    const result = await response.json();
    return parseWeatherData(result);
};

const WeatherViewer: FC<WeatherViewerProps> = ({ initialData }) => {
    const { data: timeSlots, error, isLoading } = useSWR(
        API_ENDPOINT,
        fetcher,
        {
            fallbackData: initialData,
            refreshInterval: 5 * 60 * 1000,
            revalidateOnFocus: false,
        }
    );

    const images: ImageItem[] = useMemo(() => {
        return timeSlots?.map(slot => ({
            key: slot.key,
            url: slot.url,
            alt: `${slot.hours}h weather`,
            label: slot.info?.forecastTime
                ? `${slot.hours}h later (${slot.info.forecastTime})`
                : `${slot.hours}h later`,
            width: 2000,
            height: 1800,
        })) || [];
    }, [timeSlots]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ImageGallery
                images={images}
                loading={isLoading && !initialData}
                error={error?.message || null}
                loadingMessage="Fetching weather images..."
                emptyMessage="No weather data available"
                minScreenSizeForZoom={1024}
                columns={{ mobile: 1, tablet: 1, desktop: 2, wide: 3 }}
            />
            <div className={styles.weatherFooter}>
                Data source: <a href="https://charts.ecmwf.int/products/medium-mslp-rain" target="_blank" rel="noopener noreferrer">ECMWF</a>
            </div>
        </div>
    );
};

export default WeatherViewer;
