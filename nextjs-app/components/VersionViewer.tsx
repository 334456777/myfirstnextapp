'use client';

import { FC, useState, useEffect, useRef, useCallback } from 'react';
import styles from './VersionViewer.module.css';
import { ArrowUpIcon, ArrowDownIcon } from './icons';

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
// 负责单张图片的获取、显示、错误处理和版本回传
// ==========================================
interface SingleImagePanelProps {
    imageKey: string;
    targetVersionId: string;
    shouldShow: boolean;      // 父组件控制是否允许显示（例如等待所有图片都 Ready）
    refreshKey: number;       // 用于强制刷新

    // 回调函数
    onVersionsLoaded: (key: string, versions: VersionData[]) => void;
    onImageReady: (key: string) => void;
    onRequestRefresh: () => void;
}

const SingleImagePanel: FC<SingleImagePanelProps> = ({
    imageKey,
    targetVersionId,
    shouldShow,
    refreshKey,
    onVersionsLoaded,
    onImageReady,
    onRequestRefresh
}) => {
    // UI 状态
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showSlowLoading, setShowSlowLoading] = useState(false);

    // Refs 用于请求控制
    const abortControllerRef = useRef<AbortController | null>(null);
    const slowLoadingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 核心加载逻辑
    const loadImage = useCallback(async (verId: string) => {
        if (!verId) return;

        // 1. 清理上一次未完成的请求
        if (abortControllerRef.current) abortControllerRef.current.abort();
        if (slowLoadingTimerRef.current) clearTimeout(slowLoadingTimerRef.current);

        // 2. 初始化控制器
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // 3. 重置错误，但【不】重置 currentImageUrl，保持上一张图显示直到新图加载完成
        setErrorMessage('');
        setShowSlowLoading(false);

        // 4. 启动“慢加载”计时器（超过500ms才显示loading文字，避免闪烁）
        slowLoadingTimerRef.current = setTimeout(() => {
            if (!controller.signal.aborted) setShowSlowLoading(true);
        }, 500);

        // 5. 构建请求参数
        const params = new URLSearchParams({ key: imageKey });
        if (verId !== 'latest') params.append('versionId', verId);
        params.append('_t', String(refreshKey)); // 缓存破坏

        try {
            const response = await fetch(`${BACKEND_URL}/api/image?${params.toString()}`, {
                signal: controller.signal
            });
            const result = await response.json();

            if (controller.signal.aborted) return;

            if (result.success) {
                // 回传版本信息给父组件 (如果是第一次加载)
                if (result.data.versions) {
                    const historyVersions = result.data.versions.filter((v: VersionData) => v.versionId !== 'latest');
                    const latestOption = {
                        versionId: 'latest',
                        lastModified: result.data.lastModified || new Date().toISOString()
                    };
                    onVersionsLoaded(imageKey, [latestOption, ...historyVersions]);
                }

                // 设置图片 URL
                // 注意：这里只是拿到了 URL，真正的图片加载要等 <img onLoad>
                setCurrentImageUrl(result.data.imageUrl);
            } else {
                throw new Error(result.error || 'API Failed');
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;

            console.error(`Load Error (${imageKey}):`, error);
            if (!controller.signal.aborted) {
                setErrorMessage(error.message.includes('Version not found') ? '版本不存在' : '加载失败');
                setShowSlowLoading(false);
            }
        }
    }, [imageKey, refreshKey, onVersionsLoaded]);

    // 监听版本ID或刷新键的变化
    useEffect(() => {
        loadImage(targetVersionId);
        return () => {
            // 组件卸载或更新时的清理
            if (abortControllerRef.current) abortControllerRef.current.abort();
            if (slowLoadingTimerRef.current) clearTimeout(slowLoadingTimerRef.current);
        };
    }, [targetVersionId, refreshKey, loadImage]);

    return (
        <div className={styles.singlePanelWrapper}>
            <div className={styles.panelLabel}>{imageKey.split('.')[0].toUpperCase()}</div>
            <div className={styles.imageContainer}>
                {/* 加载中提示 */}
                {showSlowLoading && !errorMessage && <div className={styles.loading}>加载中...</div>}

                {/* 错误提示 */}
                {errorMessage && <div className={styles.errorText}>{errorMessage}</div>}

                {/* 图片实体 */}
                {currentImageUrl && !errorMessage && (
                    <img
                        src={currentImageUrl}
                        alt={imageKey}
                        className={`${styles.versionImage} ${shouldShow ? styles.versionImageVisible : ''}`}
                        onLoad={() => {
                            // 图片真正下载并解码完成后
                            if (slowLoadingTimerRef.current) clearTimeout(slowLoadingTimerRef.current);
                            setShowSlowLoading(false);
                            onImageReady(imageKey);
                        }}
                        onError={() => {
                            setErrorMessage('流中断');
                            onRequestRefresh(); // 触发父组件重试
                        }}
                    />
                )}
            </div>
        </div>
    );
};


// ==========================================
// 主组件：VersionViewer
// 负责布局、导航控制和状态协调
// ==========================================
const VersionViewer: FC<VersionViewerProps> = () => {
    const IMAGE_KEYS = ['shm.jpg', 'srf.jpg', 'sra.jpg'];

    // 版本注册表：记录每张图有哪些版本
    const [versionRegistry, setVersionRegistry] = useState<Record<string, VersionData[]>>({});

    // 当前选中的是第几个版本 (0 = 最新)
    const [selectedIndex, setSelectedIndex] = useState<number>(0);

    // 强制刷新计数器
    const [refreshKey, setRefreshKey] = useState<number>(0);

    // 记录哪些图片已经加载完成
    const [readyImages, setReadyImages] = useState<Set<string>>(new Set());

    // 是否所有图片都准备好了
    const allImagesReady = IMAGE_KEYS.every(key => readyImages.has(key));

    // 处理流中断重试
    const handleRequestRefresh = useCallback(() => {
        console.log('[VersionViewer] 检测到流中断，正在刷新...');
        setRefreshKey(prev => prev + 1);
        setReadyImages(new Set()); // 重置就绪状态
    }, []);

    // 收集子组件传来的版本信息
    const handleVersionsLoaded = useCallback((key: string, versions: VersionData[]) => {
        setVersionRegistry(prev => {
            // 如果已有数据且长度一致，通常不需要更新，避免死循环
            if (prev[key]?.length === versions.length) return prev;
            return { ...prev, [key]: versions };
        });
    }, []);

    // 标记单张图片加载完成
    const handleImageReady = useCallback((key: string) => {
        setReadyImages(prev => {
            const newSet = new Set(prev);
            newSet.add(key);
            return newSet;
        });
    }, []);

    // 以第一张图 (shm.jpg) 作为时间轴基准
    const referenceVersions = versionRegistry[IMAGE_KEYS[0]] || [];

    // 日期格式化辅助函数
    const formatDate = (dateString: string) => {
        try {
            const d = new Date(dateString);
            return d.toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });
        } catch { return dateString; }
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
                                {idx === 0 ? '当前最新' : `历史版本`} ({formatDate(v.lastModified)})
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
                    // 智能降级：如果某张图缺版本，尝试匹配 index，否则回退到 latest
                    const myTargetId = myVersions?.[selectedIndex]?.versionId || 'latest';

                    return (
                        <SingleImagePanel
                            // ✅ 性能关键：Key 必须是稳定的，不要包含 selectedIndex
                            key={key}

                            imageKey={key}
                            targetVersionId={myTargetId}
                            refreshKey={refreshKey}
                            shouldShow={allImagesReady}

                            onVersionsLoaded={handleVersionsLoaded}
                            onImageReady={handleImageReady}
                            onRequestRefresh={handleRequestRefresh}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default VersionViewer;
