'use client';

import { FC } from 'react';
import dynamic from 'next/dynamic';
import styles from './DisplayArea.module.css';
import { TimeSlot } from '@/lib/weather';

const LogViewer = dynamic(() => import('./LogViewer'), {
  loading: () => <p>Loading Logs...</p>
});
const VersionViewer = dynamic(() => import('./VersionViewer'));
const WeatherViewer = dynamic(() => import('./WeatherViewer'), {
  loading: () => <p>Loading Weather...</p>
});

interface DisplayAreaProps {
    title: string;
    content: any;
    contentType: string;
    initialWeatherData?: TimeSlot[];
}

const DisplayArea: FC<DisplayAreaProps> = ({ title, content, contentType, initialWeatherData }) => {
    return (
        <div className={styles.displayArea}>
            {title && <h2 className={styles.displayHeader}>{title}</h2>}
            <div className={styles.displayContent}>
                {!content && contentType !== 'weather' && <div className={styles.empty}></div>}
                {contentType === 'log' && content && <LogViewer url={content} />}
                {contentType === 'version' && content && <VersionViewer imageKey={content} />}
                {contentType === 'weather' && <WeatherViewer initialData={initialWeatherData} />}
            </div>
        </div>
    );
};

export default DisplayArea;
