'use client';

import { FC } from 'react';
import styles from './Card.module.css';

interface CardProps {
    id: string;
    icon: string;
    title: string;
    type: string;
    data: any;
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
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
        >
            <div className={styles.cardIcon}>{icon}</div>
            <div className={styles.cardTitle}>{title}</div>
        </div>
    );
};

export default Card;
