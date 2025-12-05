'use client';

import { FC, useState, useEffect } from 'react';
import Card from './Card';
import styles from './Sidebar.module.css';
import { sidebarCards } from '@/lib/sidebar';
import { WeatherIcon, LogIcon, ErrorLogIcon, ImageIcon } from './icons';

interface SidebarProps {
    activeCardId: string | null;
    onCardEnter: (type: string, data: any, title: string, cardId: string) => void;
    onCardLeave: () => void;
    onCardClick: (type: string, data: any, title: string, cardId: string) => void;
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
        // 如果没有服务端预取数据，则在客户端检查
        if (initialVisibleCards.length === 0) {
            const checkLogFiles = async () => {
                const visible: string[] = [];

                for (const card of sidebarCards) {
                    if (card.type === 'log' && card.data) {
                        try {
                            const response = await fetch(card.data);
                            if (response.ok) {
                                const text = await response.text();
                                const lines = text.split('\n').filter(line => line.trim());
                                const hasOnlyTitle = lines.length === 1 &&
                                    (lines[0].trim() === '#' || lines[0].trim() === '# 记录严重错误');

                                if (!hasOnlyTitle) {
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

            checkLogFiles();
        }
    }, [initialVisibleCards]);

    // 根据卡片类型和状态获取对应图标
    const getIcon = (card: typeof sidebarCards[0], isActive: boolean) => {
        switch (card.type) {
            case 'weather':
                return <WeatherIcon isActive={isActive} />;
            case 'version':
                return <ImageIcon isActive={isActive} />;
            case 'log':
                // 根据 id 判断是常规日志还是错误日志
                if (card.id === 'log2') {
                    return <ErrorLogIcon />;
                }
                return <LogIcon isActive={isActive} />;
            default:
                return card.icon;
        }
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.buttonContainer}>
                {sidebarCards
                    .filter(card => visibleCards.includes(card.id))
                    .map((card) => {
                        const isActive = activeCardId === card.id;
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
