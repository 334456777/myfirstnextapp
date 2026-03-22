'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import Card from './Card';
import styles from './Sidebar.module.css';
import { sidebarCards } from '@/lib/constants';
import { WeatherIcon, LogIcon, ErrorLogIcon, ImageIcon } from './icons';

interface SidebarProps {
    activeCardId: string | null;
    onCardEnter: (type: string, data: string | null, title: string, cardId: string) => void;
    onCardLeave: () => void;
    onCardClick: (type: string, data: string | null, title: string, cardId: string) => void;
    initialVisibleCards?: string[];
}

const Sidebar: FC<SidebarProps> = ({
    activeCardId,
    onCardEnter,
    onCardLeave,
    onCardClick,
    initialVisibleCards = []
}) => {
    const [visibleCards, setVisibleCards] = useState<string[]>(initialVisibleCards);

    useEffect(() => {
        const checkLogFiles = async () => {
            const visible: string[] = [];

            for (const card of sidebarCards) {
                if (card.type === 'log' && card.data) {
                    try {
                        const response = await fetch(card.data, {
                            headers: { 'Range': 'bytes=0-1023' },
                            cache: 'no-cache' // 强制每次都检查最新文件状态
                        });

                        if (response.ok || response.status === 206) { // 206 Partial Content
                            const text = await response.text();
                            const lines = text.split('\n').filter(line => line.trim());

                            // 检查是否只有标题行（无实际日志内容）
                            const hasOnlyTitle = lines.length === 0 || (
                                lines.length <= 2 &&
                                lines[0]?.trim().startsWith('#') &&
                                (!lines[1] || lines[1]?.trim() === 'YYYY-MM-DD HH:MM:SS - LEVEL - MESSAGE')
                            );

                            const contentRange = response.headers.get('Content-Range');
                            const totalSize = contentRange ? parseInt(contentRange.split('/')[1]) : 0;

                            if (totalSize > 1024 || !hasOnlyTitle) {
                                visible.push(card.id);
                            }
                        }
                    } catch (error) {
                        console.error(`Error checking log file ${card.data}:`, error);
                    }
                } else {
                    visible.push(card.id);
                }
            }
            setVisibleCards(visible);
        };

        // 首次立即检查
        checkLogFiles();

        // 每30秒自动检查一次日志文件状态（仅在标签页可见时）
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const startPolling = () => {
            if (!intervalId) {
                intervalId = setInterval(checkLogFiles, 30000);
            }
        };
        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        const handleVisibility = () => {
            if (document.hidden) {
                stopPolling();
            } else {
                checkLogFiles();
                startPolling();
            }
        };

        startPolling();
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    const getIcon = useCallback((card: typeof sidebarCards[0], isActive: boolean) => {
        if (card.type === 'weather') return <WeatherIcon isActive={isActive} />;
        if (card.type === 'version') return <ImageIcon isActive={isActive} />;

        if (card.type === 'log') {
            if (card.id.includes('error') || card.id === 'log2') {
                return <ErrorLogIcon isActive={isActive} />;
            }
            return <LogIcon isActive={isActive} />;
        }

        return card.icon;
    }, []);

    return (
        <aside className={styles.sidebar}>
            <div className={styles.buttonContainer}>
                {sidebarCards
                    .filter((card: typeof sidebarCards[0]) => visibleCards.includes(card.id))
                    .map((card: typeof sidebarCards[0]) => {
                        const isActive: boolean = activeCardId === card.id;
                        return (
                            <Card
                                key={card.id}
                                {...card}
                                icon={getIcon(card, isActive)}
                                isActive={isActive}
                                onMouseEnter={() => onCardEnter(card.type, card.data, card.displayTitle, card.id)}
                                onMouseLeave={onCardLeave}
                                onClick={() => onCardClick(card.type, card.data, card.displayTitle, card.id)}
                            />
                        );
                    })}
            </div>
        </aside>
    );
};

export default Sidebar;
