'use client';

import { FC, useState, useEffect, useRef, useCallback } from 'react';
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

// === 子组件：独立处理单张图片的逻辑 ===
interface SingleImagePanelProps {
    imageKey: string;
    // 接收具体的 versionId，而不是通用的 selection
    targetVersionId: string;
    // 回传自己的版本列表给父组件
    onVersionsLoaded: (key: string, versions: VersionData[]) => void;
}

const SingleImagePanel: FC<SingleImagePanelProps> = ({ imageKey, targetVersionId, onVersionsLoaded }) => {
    // === UI State ===
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [isImageVisible, setIsImageVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSlowLoading, setShowSlowLoading] = useState(false);

    // === Refs ===
    const abortControllerRef = useRef<AbortController | null>(null);
    const slowLoadingTimerRef = useRef<NodeJS.Timeout | null>(null);

    const loadImage = useCallback(async (verId: string) => {
        // 如果没有 ID (比如父组件还没准备好)，先跳过
        if (!verId) return;

        // 1. 清理
        if (abortControllerRef.current) abortControllerRef.current.abort();
        if (slowLoadingTimerRef.current) clearTimeout(slowLoadingTimerRef.current);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // 2. 状态重置
        setIsImageVisible(false);
        setShowSlowLoading(false);
        setErrorMessage('');

        // 3. 启动计时器
        slowLoadingTimerRef.current = setTimeout(() => {
            if (!controller.signal.aborted) {
                setShowSlowLoading(true);
            }
        }, 500);

        // 准备参数
        const params = new URLSearchParams({ key: imageKey });
        if (verId !== 'latest') params.append('versionId', verId);

        try {
            const response = await fetch(`${BACKEND_URL}/api/image?${params.toString()}`, {
                signal: controller.signal
            });
            const fetchResult = await response.json();

            if (controller.signal.aborted) return;

            if (fetchResult.success) {
                // 成功加载后，回传版本信息给父组件进行匹配
                if (fetchResult.data.versions) {
                    const historyVersions = fetchResult.data.versions.filter((v: VersionData) => v.versionId !== 'latest');
                    const latestOption = {
                        versionId: 'latest',
                        lastModified: fetchResult.data.lastModified || new Date().toISOString()
                    };
                    // 通知父组件：我是 imageKey，我的版本列表是这个
                    onVersionsLoaded(imageKey, [latestOption, ...historyVersions]);
                }

                setCurrentImageUrl(fetchResult.data.imageUrl);
            } else {
                throw new Error(fetchResult.error || 'API Failed');
            }

        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error(`Load Error (${imageKey}):`, error);
            if (!controller.signal.aborted) {
                // 如果是 Version not found，可能是索引对其问题，显示更友好的错误
                if (error.message.includes('Version not found')) {
                    setErrorMessage('无此版本数据');
                } else {
                    setErrorMessage('加载失败');
                }
            }
            if (slowLoadingTimerRef.current) clearTimeout(slowLoadingTimerRef.current);
        }
    }, [imageKey, onVersionsLoaded]);

    // 监听目标版本 ID 变化
    useEffect(() => {
        loadImage(targetVersionId);
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            if (slowLoadingTimerRef.current) clearTimeout(slowLoadingTimerRef.current);
        };
    }, [targetVersionId, loadImage]);

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
                {errorMessage && <div style={{ color: 'red', padding: '20px', fontSize: '14px' }}>{errorMessage}</div>}

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


// === 主组件 ===
const VersionViewer: FC<VersionViewerProps> = () => {
    const IMAGE_KEYS = ['shm.jpg', 'srf.jpg', 'sra.jpg'];

    // === Data State ===
    // 存储所有图片的版本表：Record<文件名, 版本数组>
    const [versionRegistry, setVersionRegistry] = useState<Record<string, VersionData[]>>({});

    // 改为存储选中的索引（第几个版本），而不是具体的 ID
    const [selectedIndex, setSelectedIndex] = useState<number>(0);

    // 强制刷新计数器，用于触发子组件重新请求
    const [refreshKey, setRefreshKey] = useState<number>(0);

    // 每 4 分钟自动刷新一次，获取新的 token
    useEffect(() => {
        const REFRESH_INTERVAL = 4 * 60 * 1000; // 4 分钟
        const timer = setInterval(() => {
            console.log('[VersionViewer] 自动刷新 token...');
            setRefreshKey(prev => prev + 1);
        }, REFRESH_INTERVAL);

        return () => clearInterval(timer);
    }, []);

    // 回调：子组件加载完数据后，把版本表注册上来
    const handleVersionsLoaded = useCallback((key: string, versions: VersionData[]) => {
        setVersionRegistry(prev => {
            // 如果已经存过且长度一致（简单防抖），就不更新了
            if (prev[key] && prev[key].length === versions.length && prev[key][0].versionId === versions[0].versionId) {
                return prev;
            }
            return { ...prev, [key]: versions };
        });
    }, []);

    const handleVersionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedIndex(Number(event.target.value));
    };

    const formatDate = (dateString: string) => {
        try { return new Date(dateString).toLocaleDateString('zh-CN'); }
        catch { return dateString; }
    };

    // 使用第一张图 (shm.jpg) 的版本列表作为下拉菜单的显示依据
    // 假设三张图的版本数量和时间是对应的
    const referenceVersions = versionRegistry[IMAGE_KEYS[0]] || [];

    // 切换到更新的版本（索引减小）
    const handleNewerVersion = () => {
        if (selectedIndex > 0) {
            setSelectedIndex(prev => prev - 1);
        }
    };

    // 切换到更旧的版本（索引增大）
    const handleOlderVersion = () => {
        if (selectedIndex < referenceVersions.length - 1) {
            setSelectedIndex(prev => prev + 1);
        }
    };

    return (
        <div className={styles.versionViewer}>
            {/* 顶部控制栏 */}
            <div className={styles.versionInfo}>
                <div className={styles.versionNavigation}>
                    {/* 向上箭头 - 切换到更新的版本 */}
                    <button
                        className={styles.navButton}
                        onClick={handleNewerVersion}
                        disabled={selectedIndex === 0 || referenceVersions.length === 0}
                        title="更新的版本"
                    >
                        ↑
                    </button>

                    <select
                        className={styles.versionSelect}
                        value={selectedIndex}
                        onChange={handleVersionChange}
                        // 如果第一张图的数据还没回来，暂时禁用
                        disabled={referenceVersions.length === 0}
                    >
                        {referenceVersions.length === 0 && <option value={0}>加载版本中...</option>}

                        {referenceVersions.map((v, index) => (
                            // 这里 value 绑定的是 index，不是 versionId
                            <option key={`${v.versionId}-${index}`} value={index}>
                                {index === 0
                                    ? `当前最新 (${formatDate(v.lastModified)})`
                                    : `历史版本 (${formatDate(v.lastModified)})`
                                }
                            </option>
                        ))}
                    </select>

                    {/* 向下箭头 - 切换到更旧的版本 */}
                    <button
                        className={styles.navButton}
                        onClick={handleOlderVersion}
                        disabled={selectedIndex >= referenceVersions.length - 1 || referenceVersions.length === 0}
                        title="更旧的版本"
                    >
                        ↓
                    </button>
                </div>
            </div>

            {/* 图片堆叠区域 */}
            <div className={styles.imagesStack}>
                {IMAGE_KEYS.map((key) => {
                    // 核心逻辑：根据当前选中的 index，去注册表中找该图对应的 versionId
                    // 如果找不到（比如这张图版本少），回退到 'latest'
                    const myVersions = versionRegistry[key];
                    const myTargetId = myVersions?.[selectedIndex]?.versionId || 'latest';

                    return (
                        <SingleImagePanel
                            key={`${key}-${refreshKey}`}
                            imageKey={key}
                            targetVersionId={myTargetId}
                            onVersionsLoaded={handleVersionsLoaded}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default VersionViewer;
