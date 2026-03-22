'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './RotateButton.module.css';
import { RotateIcon, BackIcon } from './icons';

export default function RotateButton() {
    const [isRotated, setIsRotated] = useState(false);
    const mainRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        mainRef.current = document.querySelector('main');
    }, []);

    const handleRotate = () => {
        const mainContent = mainRef.current;
        if (!mainContent) return;

        if (!isRotated) {
            mainContent.style.transform = 'rotate(90deg)';
            mainContent.style.transformOrigin = 'center center';
            mainContent.style.width = '100vh';
            mainContent.style.height = '100vw';
            mainContent.style.position = 'fixed';
            mainContent.style.left = '50%';
            mainContent.style.top = '50%';
            mainContent.style.marginLeft = '-50vh';
            mainContent.style.marginTop = '-50vw';
            setIsRotated(true);
        } else {
            mainContent.style.transform = '';
            mainContent.style.transformOrigin = '';
            mainContent.style.width = '';
            mainContent.style.height = '';
            mainContent.style.position = '';
            mainContent.style.left = '';
            mainContent.style.top = '';
            mainContent.style.marginLeft = '';
            mainContent.style.marginTop = '';
            setIsRotated(false);
        }
    };

    return (
        <button
            className={styles.rotateBtn}
            onClick={handleRotate}
            title="旋转屏幕"
            type="button"
        >
            {isRotated ? <BackIcon className={styles.icon} /> : <RotateIcon className={styles.icon} />}
        </button>
    );
}
