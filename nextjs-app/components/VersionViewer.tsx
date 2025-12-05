'use client';

import { FC, useState, useEffect, useRef } from 'react';
import styles from './VersionViewer.module.css';

// 后端基准 URL，优先使用环境变量
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.yusteven.com';

interface VersionViewerProps {
    imageKey?: string;
}

interface VersionData {
    versionId: string;
    lastModified: string;
}

// === 子组件：简化为 Dumb Component ===
interface SingleImagePanelProps {
    imageKey: string;
    targetVersionId: string;
}

const SingleImagePanel: FC<SingleImagePanelProps> = ({ imageKey, targetVersionId }) => {
    // === UI State ===
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [isImageVisible, setIsImageVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSlowLoading, setShowSlowLoading] = useState(false);

    // === Refs ===
    const abortControllerRef = useRef<AbortController | null>(null);
    const slowLoadingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 加载图片
    useEffect(() => {
        // 如果没有 ID，先跳过
        if (!targetVersionId) return;

        // 1. 清理上一次请求
        if (abortControllerRef.current) abortControllerRef.current.abort();
        if (slowLoadingTimerRef.current) clearTimeout(slowLoadingTimerRef.current);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // 2. 状态重置
        setIsImageVisible(false);
        setShowSlowLoading(false);
        setErrorMessage('');

        // 3. 启动 Loading 计时器 (500ms 阈值)
        slowLoadingTimerRef.current = setTimeout(() => {
            if (!controller.signal.aborted) {
                setShowSlowLoading(true);
            }
        }, 500);

        // 4. 准备参数并立即发起请求
        const params = new URLSearchParams({ key: imageKey });
        if (targetVersionId !== 'latest') {
            params.append('versionId', targetVersionId);
        }

        const fetchImage = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/image?${params.toString()}`, {
                    signal: controller.signal
                });
                const fetchResult = await response.json();

                if (controller.signal.aborted) return;

                if (fetchResult.success) {
                    setCurrentImageUrl(fetchResult.data.imageUrl);
                } else {
                    throw new Error(fetchResult.error || 'API Failed');
                }
            } catch (error: any) {
                if (error.name === 'AbortError') return;
                console.error(`Load Error (${imageKey}):`, error);
                if (!controller.signal.aborted) {
                    if (error.message?.includes('Version not found')) {
                        setErrorMessage('无此版本数据');
                    } else {
                        setErrorMessage('加载失败');
                    }
                }
            } finally {
                if (slowLoadingTimerRef.current) {
                    clearTimeout(slowLoadingTimerRef.current);
                }
            }
        };

        fetchImage();

        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            if (slowLoadingTimerRef.current) clearTimeout(slowLoadingTimerRef.current);
        };
    }, [imageKey, targetVersionId]);

    const handleImageLoad = () => {
        if (slowLoadingTimerRef.current) clearTimeout(slowLoadingTimerRef.current);
        setShowSlowLoading(false);
        setIsImageVisible(true);
    };

    return (
        <div className={styles.singlePanelWrapper}>
            <div className={styles.panelLabel}>{imageKey.split('.')[0].toUpperCase()}</div>
            <div className={styles.imageContainer}>
                {showSlowLoading && !errorMessage && (
                    <div className={styles.loading}>正在缓冲...</div>
                )}
                {errorMessage && (
                    <div style={{ color: 'red', padding: '20px', fontSize: '14px' }}>{errorMessage}</div>
                )}
                {currentImageUrl && !errorMessage && (
                    <img
                        src={currentImageUrl}
                        alt={`${imageKey} Preview`}
                        className={`${styles.versionImage} ${isImageVisible ? styles.versionImageVisible : ''}`}
                        onLoad={handleImageLoad}
                        onError={() => {
                            setErrorMessage('流中断');
                            setShowSlowLoading(false);
                        }}
                    />
                )}
            </div>
        </div>
    );
};


// === 主组件 (Single Source of Truth) ===
const VersionViewer: FC<VersionViewerProps> = () => {
    const IMAGE_KEYS = ['shm.jpg', 'srf.jpg', 'sra.jpg'];
    const REFERENCE_KEY = IMAGE_KEYS[0]; // 使用 shm.jpg 作为版本列表的参考源

    // === State ===
    const [versions, setVersions] = useState<VersionData[]>([]);
    const [currentVersionId, setCurrentVersionId] = useState<string>('latest');
    const [isLoading, setIsLoading] = useState(true);

    // 挂载时统一请求一次 shm.jpg 的版本数据
    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const params = new URLSearchParams({ key: REFERENCE_KEY });
                const response = await fetch(`${BACKEND_URL}/api/image?${params.toString()}`);
                const result = await response.json();

                if (result.success && result.data.versions) {
                    const historyVersions = result.data.versions.filter(
                        (v: VersionData) => v.versionId !== 'latest'
                    );
                    const latestOption: VersionData = {
                        versionId: 'latest',
                        lastModified: result.data.lastModified || new Date().toISOString()
                    };
                    setVersions([latestOption, ...historyVersions]);
                }
            } catch (error) {
                console.error('Failed to fetch versions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchVersions();
    }, [REFERENCE_KEY]);

    const handleVersionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setCurrentVersionId(event.target.value);
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('zh-CN');
        } catch {
            return dateString;
        }
    };

    return (
        <div className={styles.versionViewer}>
            {/* 顶部控制栏 */}
            <div className={styles.versionInfo}>
                <div className={styles.versionNavigation}>
                    <select
                        className={styles.versionSelect}
                        value={currentVersionId}
                        onChange={handleVersionChange}
                        disabled={isLoading || versions.length === 0}
                    >
                        {isLoading && <option value="latest">加载版本中...</option>}
                        {!isLoading && versions.length === 0 && <option value="latest">无可用版本</option>}
                        {versions.map((v, index) => (
                            <option key={v.versionId} value={v.versionId}>
                                {index === 0
                                    ? `当前最新 (${formatDate(v.lastModified)})`
                                    : `历史版本 (${formatDate(v.lastModified)})`
                                }
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 图片堆叠区域 */}
            <div className={styles.imagesStack}>
                {IMAGE_KEYS.map((key) => (
                    <SingleImagePanel
                        key={key}
                        imageKey={key}
                        targetVersionId={currentVersionId}
                    />
                ))}
            </div>
        </div>
    );
};

export default VersionViewer;
