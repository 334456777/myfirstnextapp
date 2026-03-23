'use client';

import { FC, useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from './icons';
import styles from './VersionViewer.module.css';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.yusteven.com';

interface VersionViewerProps {}

interface VersionData {
    versionId: string;
    lastModified: string;
}

// ==========================================
// 子组件：SingleImagePanel
// 后台预加载 + 等待父组件统一 reveal
// ==========================================
interface SingleImagePanelProps {
    imageKey: string;
    targetVersionId: string;
    onVersionsLoaded: (key: string, versions: VersionData[]) => void;
    onImageReady: (key: string) => void;
    revealCounter: number;
}

const SingleImagePanel: FC<SingleImagePanelProps> = ({
    imageKey,
    targetVersionId,
    onVersionsLoaded,
    onImageReady,
    revealCounter
}) => {
    // 双层图片 URL：currentUrl 当前显示，pendingUrl 后台预加载
    const [currentUrl, setCurrentUrl] = useState('');
    const [previousUrl, setPreviousUrl] = useState('');
    const [pendingUrl, setPendingUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const abortControllerRef = useRef<AbortController | null>(null);
    const preloadImgRef = useRef<HTMLImageElement | null>(null);
    const lastRevealRef = useRef(0);
    const displayedVersionRef = useRef('');

    // 请求 API 获取图片 URL 并后台预加载
    const fetchAndPreload = useCallback(async (verId: string) => {
        if (!verId) return;

        // 取消上一次请求和预加载
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        if (preloadImgRef.current) {
            preloadImgRef.current.onload = null;
            preloadImgRef.current.onerror = null;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setErrorMessage('');
        setIsLoading(true);

        const params = new URLSearchParams({ key: imageKey });
        if (verId !== 'latest') {
            params.append('versionId', verId);
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/image?${params.toString()}`, {
                signal: controller.signal
            });
            const result = await response.json();

            if (controller.signal.aborted) return;

            if (result.success) {
                // 回传版本列表
                if (result.data.versions) {
                    const historyVersions = result.data.versions.filter(
                        (v: VersionData) => v.versionId !== 'latest'
                    );
                    const latestOption = {
                        versionId: 'latest',
                        lastModified: result.data.lastModified || new Date().toISOString()
                    };
                    onVersionsLoaded(imageKey, [latestOption, ...historyVersions]);
                }

                // 后台预加载图片
                const newUrl = result.data.imageUrl;
                setPendingUrl(newUrl);

                const img = new Image();
                preloadImgRef.current = img;
                img.onload = () => onImageReady(imageKey);
                img.onerror = () => {
                    setErrorMessage('图片加载失败');
                    setIsLoading(false);
                    onImageReady(imageKey); // 出错也通知 ready，不阻塞其他面板
                };
                img.src = newUrl;
            } else {
                throw new Error(result.error || 'API Failed');
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;

            if (!controller.signal.aborted) {
                const msg = error instanceof Error ? error.message : '';
                setErrorMessage(msg.includes('Version not found') ? '版本不存在' : '加载失败');
                setIsLoading(false);
                onImageReady(imageKey);
            }
        }
    }, [imageKey, onVersionsLoaded, onImageReady]);

    // targetVersionId 变化时：相同则立即 ready，不同则开始加载
    useEffect(() => {
        if (targetVersionId === displayedVersionRef.current && currentUrl) {
            onImageReady(imageKey);
            return;
        }
        fetchAndPreload(targetVersionId);
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetVersionId]);

    // 父组件发出 reveal 信号 → 执行 crossfade
    useEffect(() => {
        if (revealCounter > lastRevealRef.current) {
            lastRevealRef.current = revealCounter;
            if (pendingUrl) {
                setPreviousUrl(currentUrl);
                setCurrentUrl(pendingUrl);
                setPendingUrl('');
                displayedVersionRef.current = targetVersionId;
            }
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealCounter]);

    // crossfade 动画结束后清除旧图层
    const handleTransitionEnd = () => {
        setPreviousUrl('');
    };

    return (
        <div className={styles.singlePanelWrapper}>
            <div className={styles.panelLabel}>
                <span>{imageKey.split('.')[0].toUpperCase()}</span>
                {isLoading && (
                    <span className={styles.statusText}>加载中...</span>
                )}
                {errorMessage && (
                    <span className={styles.errorText}>{errorMessage}</span>
                )}
            </div>
            <div className={styles.imageContainer}>
                {/* 旧图层：crossfade 期间保持可见 */}
                {previousUrl && (
                    <img
                        src={previousUrl}
                        alt=""
                        className={`${styles.versionImage} ${styles.imageLayerOld}`}
                    />
                )}
                {/* 当前图层：新图淡入 */}
                {currentUrl && !errorMessage && (
                    <img
                        key={currentUrl}
                        src={currentUrl}
                        alt={imageKey}
                        className={`${styles.versionImage} ${styles.fadeIn}`}
                        onAnimationEnd={handleTransitionEnd}
                    />
                )}

                {errorMessage && (
                    <button
                        className={styles.retryButton}
                        onClick={() => fetchAndPreload(targetVersionId)}
                    >
                        点击重试
                    </button>
                )}
            </div>
        </div>
    );
};


// ==========================================
// 主组件：VersionViewer
// 负责布局、导航和同步协调
// ==========================================
const IMAGE_KEYS = ['shm.jpg', 'srf.jpg', 'sra.jpg'];

const VersionViewer: FC<VersionViewerProps> = () => {
    const [versionRegistry, setVersionRegistry] = useState<Record<string, VersionData[]>>({});
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [readyKeys, setReadyKeys] = useState<Set<string>>(new Set());
    const [revealCounter, setRevealCounter] = useState(0);

    const handleVersionsLoaded = useCallback((key: string, versions: VersionData[]) => {
        setVersionRegistry(prev => {
            const existing = prev[key];
            if (existing && existing.length === versions.length &&
                existing.every((v, i) => v.versionId === versions[i].versionId)) {
                return prev;
            }
            return { ...prev, [key]: versions };
        });
    }, []);

    const handleImageReady = useCallback((key: string) => {
        setReadyKeys(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

    // 切换版本 — 同时重置 ready 状态
    const changeVersion = useCallback((newIndex: number) => {
        setSelectedIndex(newIndex);
        setReadyKeys(new Set());
    }, []);

    // 3 张都 ready → 统一 reveal
    useEffect(() => {
        if (readyKeys.size === IMAGE_KEYS.length) {
            setRevealCounter(c => c + 1);
        }
    }, [readyKeys.size]);

    const referenceVersions = versionRegistry[IMAGE_KEYS[0]] || [];

    const formatDate = (dateString: string, isLatest: boolean) => {
        try {
            const d = new Date(dateString);
            if (isLatest) {
                return d.toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}/${month}/${day}`;
        } catch {
            return dateString;
        }
    };

    const getVersionLabel = (index: number) => {
        if (index === 0) return '当前最新';
        if (index === referenceVersions.length - 1) return '最早版本';
        return '历史版本';
    };

    return (
        <div className={styles.versionViewer}>
            {/* 顶部控制栏 */}
            <div className={styles.versionInfo}>
                <div className={styles.versionNavigation}>
                    <button
                        className={styles.navButton}
                        onClick={() => changeVersion(Math.max(0, selectedIndex - 1))}
                        disabled={selectedIndex === 0 || !referenceVersions.length}
                        title="查看更新的版本"
                        aria-label="Newer Version"
                    >
                        <ArrowUpIcon />
                    </button>

                    <select
                        className={styles.versionSelect}
                        value={selectedIndex}
                        onChange={(e) => changeVersion(Number(e.target.value))}
                        disabled={!referenceVersions.length}
                        aria-label="选择版本"
                    >
                        {!referenceVersions.length && <option>加载版本列表中...</option>}
                        {referenceVersions.map((v, idx) => (
                            <option key={`${v.versionId}-${idx}`} value={idx}>
                                {getVersionLabel(idx)} ({formatDate(v.lastModified, idx === 0)})
                            </option>
                        ))}
                    </select>

                    <button
                        className={styles.navButton}
                        onClick={() => changeVersion(Math.min(referenceVersions.length - 1, selectedIndex + 1))}
                        disabled={selectedIndex >= referenceVersions.length - 1 || !referenceVersions.length}
                        title="查看更旧的版本"
                        aria-label="Older Version"
                    >
                        <ArrowDownIcon />
                    </button>
                </div>
            </div>

            {/* 图片堆叠显示区域 */}
            <div className={styles.imagesStack}>
                {IMAGE_KEYS.map((key) => {
                    const myVersions = versionRegistry[key];
                    const myTargetId = myVersions?.[selectedIndex]?.versionId || 'latest';

                    return (
                        <SingleImagePanel
                            key={key}
                            imageKey={key}
                            targetVersionId={myTargetId}
                            onVersionsLoaded={handleVersionsLoaded}
                            onImageReady={handleImageReady}
                            revealCounter={revealCounter}
                        />
                    );
                })}
            </div>

            {/* 页脚 */}
            <div className={styles.footer}>
                数据来源：<a href="https://sos70.ru" target="_blank" rel="noopener noreferrer">sos70.ru</a>
            </div>
        </div>
    );
};

export default VersionViewer;
