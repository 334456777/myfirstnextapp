'use client';

import { FC, ReactNode, useState } from 'react';
import { Gallery, Item } from 'react-photoswipe-gallery';
import 'photoswipe/dist/photoswipe.css';
import styles from './ImageGallery.module.css';

export interface ImageItem {
    key: string;
    url: string;
    alt?: string;
    label?: string;
    width?: number;   // 新增：自定义图片宽度
    height?: number;  // 新增：自定义图片高度
}

interface ImageGalleryProps {
    images: ImageItem[];
    enableZoomOnMobile?: boolean;
    minScreenSizeForZoom?: number;
    columns?: {
        mobile?: number;
        tablet?: number;
        desktop?: number;
        wide?: number;
    };
    loading?: boolean;
    error?: string | null;
    emptyMessage?: string;
    loadingMessage?: string;
    renderLabel?: (item: ImageItem) => ReactNode;
    zoomConfig?: {
        maxZoom?: number;
        wheelSensitivity?: number;
        animationDuration?: number;
    };
    uiConfig?: {
        showZoomIndicator?: boolean;
        showZoomButton?: boolean;
        showCounter?: boolean;
        showCaption?: boolean;
    };
    bgOpacity?: number;
    animationConfig?: {
        fadeIn?: number;
        fadeOut?: number;
    };
}

const ImageGallery: FC<ImageGalleryProps> = ({
    images,
    enableZoomOnMobile = false,
    minScreenSizeForZoom = 1024,
    columns = { mobile: 1, tablet: 1, desktop: 2, wide: 3 },
    loading = false,
    error = null,
    emptyMessage = 'No images available',
    loadingMessage = 'Loading images...',
    renderLabel,
    zoomConfig = {},
    uiConfig = {},
    bgOpacity = 0.9,
    animationConfig = {},
}) => {
    const [savedZoom, setSavedZoom] = useState<number>(1);
    const [savedPosition, setSavedPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const {
        maxZoom = 10,
        wheelSensitivity = 0.002,
        animationDuration = 500,
    } = zoomConfig;

    const {
        showZoomIndicator = true,
        showZoomButton = true,
        showCounter = true,
        showCaption = true,
    } = uiConfig;

    const {
        fadeIn = 250,
        fadeOut = 250,
    } = animationConfig;

    if (loading) return <div className={styles.loading}>{loadingMessage}</div>;
    if (error) return <div className={styles.error}>{error}</div>;
    if (!images || images.length === 0) return <div className={styles.loading}>{emptyMessage}</div>;

    const photoswipeOptions = {
        zoom: true,
        wheelToZoom: true,
        clickToCloseNonZoomable: false,
        closeOnVerticalDrag: false,
        pinchToClose: false,
        initialZoomLevel: 'fit' as const,
        secondaryZoomLevel: 2,
        maxZoomLevel: maxZoom,
        zoomAnimationDuration: animationDuration,
        wheelToZoomScale: wheelSensitivity,
        padding: { top: 20, bottom: 20, left: 20, right: 20 },
        bgOpacity: bgOpacity,
        showHideAnimationType: 'fade' as const,
        showAnimationDuration: fadeIn,
        hideAnimationDuration: fadeOut,
        counter: showCounter,
    };

    const handleGalleryInit = (pswp: any) => {
        pswp.on('zoomPanUpdate', (e: any) => {
            if (pswp.currSlide) {
                setSavedZoom(pswp.currSlide.currZoomLevel || 1);
                setSavedPosition({
                    x: pswp.currSlide.pan?.x || 0,
                    y: pswp.currSlide.pan?.y || 0,
                });
            }
        });

        pswp.on('change', () => {
            setTimeout(() => {
                if (pswp.currSlide && savedZoom > 1) {
                    const centerPoint = {
                        x: pswp.currSlide.width / 2,
                        y: pswp.currSlide.height / 2,
                    };
                    pswp.currSlide.zoomTo(savedZoom, centerPoint, 0);

                    if (savedPosition.x !== 0 || savedPosition.y !== 0) {
                        pswp.currSlide.pan.x = savedPosition.x;
                        pswp.currSlide.pan.y = savedPosition.y;
                        pswp.currSlide.applyCurrentZoomPan();
                    }
                }
            }, 100);
        });
    };

    const uiElements = [];

    if (showZoomIndicator) {
        uiElements.push({
            name: 'zoom-level-indicator',
            order: 10,
            isButton: false,
            html: `<div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.7); color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; pointer-events: none;">100%</div>`,
            onInit: (el: HTMLElement, pswp: any) => {
                pswp.on('zoomPanUpdate', () => {
                    if (pswp.currSlide) {
                        const zoomLevel = Math.round(pswp.currSlide.currZoomLevel * 100);
                        el.innerHTML = `<div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.7); color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; pointer-events: none;">${zoomLevel}%</div>`;
                    }
                });
            },
        });
    }

    if (showZoomButton) {
        uiElements.push({
            name: 'zoom-button',
            order: 9,
            isButton: true,
            html: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/></svg>',
            appendTo: 'bar' as const,
            onClick: (e: any, pswp: any) => {
                const currZoomLevel = pswp.currSlide.currZoomLevel;
                if (currZoomLevel >= pswp.currSlide.zoomLevels.max) {
                    pswp.currSlide.zoomTo(pswp.currSlide.zoomLevels.initial, { x: 0, y: 0 }, 333);
                } else {
                    pswp.currSlide.zoomTo(pswp.currSlide.zoomLevels.secondary, { x: 0, y: 0 }, 333);
                }
            },
        });
    }

    return (
        <Gallery
            options={photoswipeOptions}
            uiElements={uiElements as any}
            onOpen={handleGalleryInit}
        >
            <div
                className={styles.imageContainer}
                style={{
                    '--columns-mobile': columns.mobile || 1,
                    '--columns-tablet': columns.tablet || 1,
                    '--columns-desktop': columns.desktop || 2,
                    '--columns-wide': columns.wide || 3,
                } as React.CSSProperties}
            >
                {images.map((item, index) => (
                    <div key={item.key} className={styles.imageWrapper}>
                        {(item.label || renderLabel) && (
                            <div className={styles.imageLabel}>
                                {renderLabel ? renderLabel(item) : item.label}
                            </div>
                        )}
                        <Item
                            original={item.url}
                            thumbnail={item.url}
                            width={String(item.width || 1200)}
                            height={String(item.height || 800)}
                            alt={item.alt || item.label || `Image ${index + 1}`}
                        >
                            {({ ref, open }: any) => (
                                <>
                                    <div className={styles.imagePlaceholder}>
                                        <div className={styles.spinner}></div>
                                        <div style={{ marginTop: '20px', color: '#999' }}>Loading image...</div>
                                    </div>
                                    <img
                                        ref={ref}
                                        src={item.url}
                                        alt={item.alt || item.label || `Image ${index + 1}`}
                                        className={styles.image}
                                        style={{
                                            cursor: (enableZoomOnMobile || (typeof window !== 'undefined' && window.innerWidth >= minScreenSizeForZoom)) ? 'pointer' : 'default'
                                        }}
                                        onClick={(e) => {
                                            if (enableZoomOnMobile || (typeof window !== 'undefined' && window.innerWidth >= minScreenSizeForZoom)) {
                                                open(e);
                                            }
                                        }}
                                        onLoad={(e) => {
                                            const img = e.currentTarget;
                                            const placeholder = img.previousElementSibling as HTMLElement;
                                            if (placeholder) {
                                                placeholder.style.display = 'none';
                                            }
                                            img.style.opacity = '1';
                                        }}
                                        onError={(e) => {
                                            const img = e.currentTarget;
                                            const placeholder = img.previousElementSibling as HTMLElement;
                                            if (placeholder) {
                                                placeholder.innerHTML = '<div class="error">Image load failed</div>';
                                            }
                                            img.style.display = 'none';
                                        }}
                                    />
                                </>
                            )}
                        </Item>
                    </div>
                ))}
            </div>
        </Gallery>
    );
};

export default ImageGallery;
