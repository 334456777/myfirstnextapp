'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import DisplayArea from './DisplayArea';
import RotateButton from './RotateButton';
import styles from './MainContent.module.css';
import { TimeSlot } from '@/lib/weather';

interface MainContentProps {
    initialWeatherData?: TimeSlot[];
    initialVisibleCards?: string[];
}

export default function MainContent({ initialWeatherData, initialVisibleCards }: MainContentProps) {
    const [isLocked, setIsLocked] = useState(false);
    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const [displayTitle, setDisplayTitle] = useState('');
    const [displayContent, setDisplayContent] = useState<string | null>(null);
    const [contentType, setContentType] = useState<string>('');

    const handleCardEnter = (type: string, data: string | null, title: string, cardId: string) => {
        if (!isLocked) {
            setDisplayTitle(title);
            setContentType(type);
            setDisplayContent(data);
        }
    };

    const handleCardLeave = () => {
        if (!isLocked) {
            setDisplayTitle('');
            setDisplayContent(null);
            setContentType('');
        }
    };

    const handleCardClick = (type: string, data: string | null, title: string, cardId: string) => {
        if (isLocked && activeCardId === cardId) {
            setIsLocked(false);
            setActiveCardId(null);
            setDisplayTitle('');
            setDisplayContent(null);
            setContentType('');
        } else {
            setIsLocked(true);
            setActiveCardId(cardId);
            setDisplayTitle(title);
            setContentType(type);
            setDisplayContent(data);
        }
    };

    return (
        <div className={styles.pageContainer}>
            <Sidebar
                activeCardId={activeCardId}
                onCardEnter={handleCardEnter}
                onCardLeave={handleCardLeave}
                onCardClick={handleCardClick}
                initialVisibleCards={initialVisibleCards}
            />
            <RotateButton />
            <main className={styles.mainContent}>
                <DisplayArea
                    title={displayTitle}
                    content={displayContent}
                    contentType={contentType}
                    initialWeatherData={initialWeatherData}
                />
            </main>
        </div>
    );
}
