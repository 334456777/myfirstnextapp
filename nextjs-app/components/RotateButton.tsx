'use client';

import { useState } from 'react';
import styles from './RotateButton.module.css';

export default function RotateButton() {
    const [isRotated, setIsRotated] = useState(false);

    const handleRotate = () => {
        const mainContent = document.querySelector('main');
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
            {isRotated ? '↩️' : '🔄'}
        </button>
    );
}
