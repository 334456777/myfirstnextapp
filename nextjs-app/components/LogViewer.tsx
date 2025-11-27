'use client';

import { FC, useEffect, useState } from 'react';
import styles from './LogViewer.module.css';

interface LogViewerProps {
    url: string;
}

const LogViewer: FC<LogViewerProps> = ({ url }) => {
    const [logContent, setLogContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLog = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to load log');
                const text = await response.text();
                setLogContent(text);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLog();
    }, [url]);

    const processLogContent = (logText: string) => {
        if (!logText || !logText.trim()) {
            return <div className={styles.logContent}>日志为空</div>;
        }

        const lines = logText.split('\n');
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
            return <div className={styles.logContent}>{logText}</div>;
        }

        const latestDate = sortedDates[0];
        const latestLogs = dateGroups[latestDate];

        // 将最新日志按 <-- 标记分组
        const groupLatestLogs = (logs: string[]) => {
            const groups: string[][] = [];
            let currentGroup: string[] = [];

            for (const line of logs) {
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

            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }

            return groups.reverse(); // 反转以显示最新的在前
        };

        const latestLogGroups = groupLatestLogs(latestLogs);

        return (
            <div className={styles.logContent}>
                <div className={styles.logBody}>
                    <div className={styles.dateSectionLabel}>Latest Logs ({latestDate})</div>

                    {latestLogGroups.map((group, groupIndex) => (
                        <div key={groupIndex} className={styles.latestLogCard}>
                            {group.map((line, lineIndex) => (
                                <div key={lineIndex}>{line}</div>
                            ))}
                        </div>
                    ))}

                    {sortedDates.length > 1 && !shouldHideButton && (
                        <>
                            <button className={styles.historyToggleBtn} onClick={(e) => {
                                const historyLogs = e.currentTarget.nextElementSibling as HTMLElement;
                                if (historyLogs) {
                                    const isHidden = historyLogs.style.display === 'none';
                                    historyLogs.style.display = isHidden ? 'block' : 'none';
                                    const icon = e.currentTarget.querySelector(`.${styles.toggleIcon}`);
                                    if (icon) {
                                        icon.textContent = isHidden ? '▲' : '▼';
                                    }
                                }
                            }}>
                                <span className={styles.toggleIcon}>▼</span>
                                <span className={styles.toggleText}>View History ({sortedDates.length - 1} dates)</span>
                            </button>
                            <div className={styles.historyLogs} style={{ display: 'none' }}>
                                {sortedDates.slice(1).map((date) => (
                                    <div key={date} className={styles.historySection}>
                                        <div className={styles.logDateLabel}>{date}</div>
                                        {dateGroups[date].map((line, idx) => (
                                            <div key={idx}>{line}</div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <div className={styles.loading}>Loading...</div>;
    if (error) return <div className={styles.error}>Load failed: {error}</div>;

    return <>{processLogContent(logContent)}</>;
};

export default LogViewer;
