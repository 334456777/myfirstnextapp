'use client';

import { FC, useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from './icons';
import styles from './VersionViewer.module.css';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.yusteven.com';

interface VersionViewerProps {
    imageKey?: string;
}

interface VersionData {
    versionId: string;
    lastModified: string;
}

// ==========================================
// 子组件：SingleImagePanel
// 负责单张图片的获取和显示
// ==========================================
interface SingleImagePanelProps {
    imageKey: string;
    targetVersionId: string;
    onVersionsLoaded: (key: string, versions: VersionData[]) => void;
}

const SingleImagePanel: FC<SingleImagePanelProps> = ({
    imageKey,
    targetVersionId,
    onVersionsLoaded
}) => {
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);

    const loadImage = useCallback(async (verId: string) => {
        if (!verId) return;

        // 取消上一次请求
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
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
                // 回传版本信息
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

                setCurrentImageUrl(result.data.imageUrl);
                setIsLoading(false);
            } else {
                throw new Error(result.error || 'API Failed');
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;

            console.error(`Load Error (${imageKey}):`, error);
            if (!controller.signal.aborted) {
                const isVersionError = error.message.includes('Version not found');
                setErrorMessage(isVersionError ? '版本不存在' : '加载失败');
                setIsLoading(false);
            }
        }
    }, [imageKey, onVersionsLoaded]);

    // 处理图片加载错误
    const handleImageError = useCallback(() => {
        console.warn(`[${imageKey}] 图片加载失败`);
        setErrorMessage('图片加载失败');
        setIsLoading(false);
    }, [imageKey]);

    // 重试加载
    const handleRetry = useCallback(() => {
        loadImage(targetVersionId);
    }, [loadImage, targetVersionId]);

    useEffect(() => {
        loadImage(targetVersionId);
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [targetVersionId, loadImage]);

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
                {/* 图片实体 */}
                {currentImageUrl && !errorMessage && (
                    <img
                        src={currentImageUrl}
                        alt={imageKey}
                        className={styles.versionImage}
                        onLoad={() => setIsLoading(false)}
                        onError={handleImageError}
                    />
                )}

                {/* 显示错误时的重试按钮 */}
                {errorMessage && (
                    <button
                        className={styles.retryButton}
                        onClick={handleRetry}
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
// 负责布局和导航控制
// ==========================================
const VersionViewer: FC<VersionViewerProps> = () => {
    const IMAGE_KEYS = ['shm.jpg', 'srf.jpg', 'sra.jpg'];

    // 版本注册表
    const [versionRegistry, setVersionRegistry] = useState<Record<string, VersionData[]>>({});

    // 当前选中的版本索引
    const [selectedIndex, setSelectedIndex] = useState<number>(0);

    // 收集子组件传来的版本信息
    const handleVersionsLoaded = useCallback((key: string, versions: VersionData[]) => {
        setVersionRegistry(prev => {
            if (prev[key]?.length === versions.length) return prev;
            return { ...prev, [key]: versions };
        });
    }, []);

    // 以第一张图作为时间轴基准
    const referenceVersions = versionRegistry[IMAGE_KEYS[0]] || [];

    // 日期格式化
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

    // 获取版本标签
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
                    {/* 上一张（更新） */}
                    <button
                        className={styles.navButton}
                        onClick={() => setSelectedIndex(p => Math.max(0, p - 1))}
                        disabled={selectedIndex === 0 || !referenceVersions.length}
                        title="查看更新的版本"
                        aria-label="Newer Version"
                    >
                        <ArrowUpIcon />
                    </button>

                    {/* 版本下拉菜单 */}
                    <select
                        className={styles.versionSelect}
                        value={selectedIndex}
                        onChange={(e) => setSelectedIndex(Number(e.target.value))}
                        disabled={!referenceVersions.length}
                    >
                        {!referenceVersions.length && <option>加载版本列表中...</option>}
                        {referenceVersions.map((v, idx) => (
                            <option key={`${v.versionId}-${idx}`} value={idx}>
                                {getVersionLabel(idx)} ({formatDate(v.lastModified, idx === 0)})
                            </option>
                        ))}
                    </select>

                    {/* 下一张（更旧） */}
                    <button
                        className={styles.navButton}
                        onClick={() => setSelectedIndex(p => Math.min(referenceVersions.length - 1, p + 1))}
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
                        />
                    );
                })}
            </div>

            {/* 页脚 - 来源标注 */}
            <div className={styles.footer}>
                数据来源：<a href="https://sos70.ru" target="_blank" rel="noopener noreferrer">sos70.ru</a>
            </div>
        </div>
    );
};

export default VersionViewer;
