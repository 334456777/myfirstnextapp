'use client';

import { FC, useEffect, useState, useMemo } from 'react';
import styles from './LogViewer.module.css';

interface LogViewerProps {
    url: string;
}

interface ParsedLogs {
    latestDate: string;
    latestGroups: string[][];
    historyDates: string[];
    allGroups: { [key: string]: string[] };
    shouldHideButton: boolean;
    isEmpty: boolean;
}

const LogViewer: FC<LogViewerProps> = ({ url }) => {
    const [logContent, setLogContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        const fetchLog = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(url, {
                    // 'no-cache' 并不意味着不缓存，而是意味着：
                    // "在每次使用缓存前，必须先发请求给服务器确认文件是否修改过 (ETag/Last-Modified)"
                    // 1. 如果没变 -> 服务器返回 304，浏览器读取本地缓存 (0KB 流量)
                    // 2. 如果变了 -> 服务器返回 200，浏览器下载新内容
                    cache: 'no-cache',
                });

                if (!response.ok) throw new Error(`Failed to load log: ${response.status}`);

                const text = await response.text();
                setLogContent(text);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchLog();
    }, [url]);

    const parsedData: ParsedLogs = useMemo(() => {
        if (!logContent || !logContent.trim()) {
            return {
                latestDate: '', latestGroups: [], historyDates: [],
                allGroups: {}, shouldHideButton: false, isEmpty: true
            };
        }

        const lines = logContent.split('\n');
        const firstLine = lines[0].trim();
        const shouldHideButton = firstLine === '#';

        const dateGroups: { [key: string]: string[] } = {};
        let currentDate: string | null = null;
        const dateRegex = /^(\d{4}-\d{2}-\d{2})/;

        for (const line of lines) {
            const match = line.match(dateRegex);
            if (match) {
                const extractedDate = match[1];
                if (extractedDate !== currentDate) {
                    currentDate = extractedDate;
                    if (!dateGroups[currentDate]) {
                        dateGroups[currentDate] = [];
                    }
                }
                dateGroups[currentDate].push(line);
            } else {
                if (currentDate && line.trim()) {
                    dateGroups[currentDate].push(line);
                }
            }
        }

        const sortedDates = Object.keys(dateGroups).sort().reverse();

        if (sortedDates.length === 0) {
            return {
                latestDate: '', latestGroups: [], historyDates: [],
                allGroups: {}, shouldHideButton: false, isEmpty: false
            };
        }

        const latestDate = sortedDates[0];
        const latestLogs = dateGroups[latestDate];

        const groups: string[][] = [];
        let currentGroup: string[] = [];
        for (const line of latestLogs) {
            if (line.includes('<--')) {
                if (currentGroup.length > 0) {
                    groups.push([...currentGroup]);
                    currentGroup = [line];
                } else {
                    currentGroup.push(line);
                }
            } else {
                currentGroup.push(line);
            }
        }
        if (currentGroup.length > 0) groups.push(currentGroup);
        const latestGroups = groups.reverse();

        return {
            latestDate,
            latestGroups,
            historyDates: sortedDates.slice(1),
            allGroups: dateGroups,
            shouldHideButton,
            isEmpty: false
        };

    }, [logContent]);

    if (loading) return <div className={styles.loading}>Loading...</div>;
    if (error) return <div className={styles.error}>Load failed: {error}</div>;

    if (parsedData.isEmpty && !parsedData.latestDate) {
        return <div className={styles.logContent}>{logContent || "日志为空"}</div>;
    }

    return (
        <div className={styles.logContent}>
            <div className={styles.logBody}>
                <div className={styles.dateSectionLabel}>Latest Logs ({parsedData.latestDate})</div>

                {parsedData.latestGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className={styles.latestLogCard}>
                        {group.map((line, lineIndex) => (
                            <div key={lineIndex}>{line}</div>
                        ))}
                    </div>
                ))}

                {parsedData.historyDates.length > 0 && !parsedData.shouldHideButton && (
                    <button
                        className={styles.historyToggleBtn}
                        onClick={() => setShowHistory(!showHistory)}
                        aria-expanded={showHistory}
                    >
                        <span className={styles.toggleIcon}>{showHistory ? '▲' : '▼'}</span>
                        <span className={styles.toggleText}>
                            {showHistory ? 'Hide History' : `View History`}
                        </span>
                    </button>
                )}

                {showHistory && (
                    <div className={styles.historyLogs}>
                        {parsedData.historyDates.map((date) => (
                            <div key={date} className={styles.historySection}>
                                <div className={styles.logDateLabel}>{date}</div>
                                {parsedData.allGroups[date].map((line, idx) => (
                                    <div key={idx}>{line}</div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LogViewer;
