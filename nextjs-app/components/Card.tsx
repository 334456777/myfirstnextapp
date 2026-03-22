'use client';

import { FC, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
    id: string;
    icon: string | ReactNode;
    title: string;
    type: string;
    data: string | null;
    displayTitle: string;
    isActive: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
}

const Card: FC<CardProps> = ({ icon, title, isActive, onMouseEnter, onMouseLeave, onClick }) => {
    return (
        <div
            className={`${styles.card} ${isActive ? styles.active : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            <div className={styles.cardIcon}>{icon}</div>
            <div className={styles.cardTitle}>{title}</div>
        </div>
    );
};

export default Card;
