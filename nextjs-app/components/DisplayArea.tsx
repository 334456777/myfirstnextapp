'use client';

import { FC, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from './DisplayArea.module.css';
import { TimeSlot } from '@/lib/weather';

const LogViewer = dynamic(() => import('./LogViewer'));
const VersionViewer = dynamic(() => import('./VersionViewer'));
const WeatherViewer = dynamic(() => import('./WeatherViewer'));

/* ── 实时时钟空白页 ── */
const IdleClock: FC = () => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    return (
        <div className={styles.idle}>
            <div className={styles.clock}>{time}</div>
            <div className={styles.date}>{date}</div>
            <div className={styles.hint}>
                <svg className={styles.hintArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                </svg>
                <span className={styles.hintText}>选择左侧卡片以查看详情</span>
            </div>
        </div>
    );
};

interface DisplayAreaProps {
    title: string;
    content: string | null;
    contentType: string;
    initialWeatherData?: TimeSlot[];
}

const isIdle = (content: string | null, contentType: string) =>
    !content && contentType !== 'weather';

const DisplayArea: FC<DisplayAreaProps> = ({ title, content, contentType, initialWeatherData }) => {
    return (
        <div className={styles.displayArea}>
            {title && <h2 className={styles.displayHeader}>{title}</h2>}
            <div className={styles.displayContent}>
                {isIdle(content, contentType) && <IdleClock />}
                {contentType === 'log' && content && <LogViewer url={content} />}
                {contentType === 'version' && content && <VersionViewer />}
                {contentType === 'weather' && <WeatherViewer initialData={initialWeatherData} />}
            </div>
        </div>
    );
};

export default DisplayArea;
