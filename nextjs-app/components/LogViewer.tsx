'use client';

import { FC, useEffect, useState, useMemo, useRef } from 'react';
import styles from './LogViewer.module.css';

interface LogViewerProps {
    url: string;
}

// === 日志解析类型 ===

interface ParsedLine {
    time: string;
    level: string;
    message: string;
    type: 'check-start' | 'result' | 'stars' | 'interval' | 'next-check' | 'signal' | 'startup' | 'normal';
    foundNew?: boolean;
    starCount?: number;
    subResults?: { label: string; found: boolean }[];
}

interface CheckCycle {
    date: string;
    startTime: string;
    lines: ParsedLine[];
    foundNew: boolean;
    starCount: number;
    nextCheck?: string;
    interval?: string;
}

// === 解析 ===

const LINE_RE = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+-\s+(\w+)\s+-\s+(.+)$/;

function parseLine(raw: string): { date: string; line: ParsedLine } | null {
    const m = raw.trim().match(LINE_RE);
    if (!m) return null;

    const [, date, time, level, rawMsg] = m;
    const message = rawMsg.replace(/\s*<--\s*$/, '').trim();

    let type: ParsedLine['type'] = 'normal';
    let foundNew: boolean | undefined;
    let starCount: number | undefined;
    let subResults: ParsedLine['subResults'];

    if (rawMsg.includes('<--') || message === '检查开始') {
        type = 'check-start';
    } else if (message.startsWith('预检查完成')) {
        type = 'result';
        foundNew = message.includes('发现新内容');
        subResults = [];
        const predMatch = message.match(/预测检查:\s*(\S+)/);
        const quickMatch = message.match(/快速检查:\s*(\S+)/);
        if (predMatch) subResults.push({ label: '预测', found: predMatch[1].includes('发现') });
        if (quickMatch) subResults.push({ label: '快速', found: quickMatch[1].includes('发现') });
    } else if (/^\*+$/.test(message)) {
        type = 'stars';
        starCount = message.length;
    } else if (message.includes('轮询间隔') || message.startsWith('WGMM调频')) {
        type = 'interval';
    } else if (message.startsWith('下次检查')) {
        type = 'next-check';
    } else if (message.includes('收到信号') || message.includes('退出')) {
        type = 'signal';
    } else if (message.includes('距离上次检查')) {
        type = 'startup';
    }

    return { date, line: { time, level, message, type, foundNew, starCount, subResults } };
}

function parseLog(content: string) {
    if (!content?.trim()) {
        return { cycles: [] as CheckCycle[], isEmpty: true };
    }

    const rawLines = content.split('\n');
    const cycles: CheckCycle[] = [];
    let cur: CheckCycle | null = null;

    for (const raw of rawLines) {
        const p = parseLine(raw);
        if (!p) continue;
        const { date, line } = p;

        if (line.type === 'check-start') {
            if (cur) cycles.push(cur);
            cur = { date, startTime: line.time, lines: [line], foundNew: false, starCount: 0 };
        } else if (cur) {
            cur.lines.push(line);
            if (line.type === 'result' && line.foundNew) cur.foundNew = true;
            if (line.type === 'stars' && line.starCount) {
                cur.starCount = line.starCount;
                cur.foundNew = true;
            }
            if (line.type === 'next-check') cur.nextCheck = line.message.replace(/^下次检查:\s*/, '');
            if (line.type === 'interval') {
                const im = line.message.match(/轮询间隔:\s*(.+)/);
                if (im) cur.interval = im[1];
            }
        }
    }
    if (cur) cycles.push(cur);

    cycles.sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));

    return { cycles, isEmpty: false };
}

function parseNextCheckDate(dateStr: string): Date | null {
    const m = dateStr.match(/(\d{4})年(\d{2})月(\d{2})日.*?(\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function formatElapsed(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(h / 24);
    const rh = h % 24;
    const mins = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return rh > 0 ? `${d}天${rh}小时` : `${d}天`;
    if (h > 0) return mins > 0 ? `${h}小时${mins}分` : `${h}小时`;
    return `${Math.max(mins, 1)}分钟`;
}

function formatShortDate(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
}

// === 子组件：时间线条目 ===

const TlEntry: FC<{ line: ParsedLine }> = ({ line }) => {
    let iconClass = styles.iconDefault;
    let icon = '·';

    switch (line.type) {
        case 'result':
            iconClass = line.foundNew ? styles.iconGreen : styles.iconMuted;
            icon = line.foundNew ? '✓' : '—';
            break;
        case 'stars':
            iconClass = styles.iconGreen;
            icon = '★';
            break;
        case 'next-check':
            iconClass = styles.iconBlue;
            icon = '▸';
            break;
        case 'interval':
            iconClass = styles.iconMuted;
            icon = '↻';
            break;
        case 'signal':
            iconClass = styles.iconOrange;
            icon = '⚠';
            break;
        case 'startup':
            iconClass = styles.iconBlue;
            icon = '→';
            break;
    }

    if (line.type === 'result' && line.subResults) {
        return (
            <div className={styles.tlEntry}>
                <span className={styles.tlEntryTime}>{line.time}</span>
                <span className={`${styles.tlEntryIcon} ${iconClass}`}>{icon}</span>
                <div className={styles.tlEntryContent}>
                    <span className={styles.resultLabel}>预检查完成</span>
                    <div className={styles.subResults}>
                        {line.subResults.map((sub, i) => (
                            <span key={i} className={sub.found ? styles.subFound : styles.subNotFound}>
                                {sub.label}: {sub.found ? '发现新内容' : '无新内容'}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (line.type === 'stars') {
        return (
            <div className={`${styles.tlEntry} ${styles.starsRow}`}>
                <span className={styles.tlEntryTime}>{line.time}</span>
                <span className={`${styles.tlEntryIcon} ${iconClass}`}>{icon}</span>
                <span className={styles.tlEntryContent}>
                    新增 <strong>{line.starCount}</strong> 项内容
                </span>
            </div>
        );
    }

    if (line.type === 'interval') {
        const im = line.message.match(/轮询间隔:\s*(.+)/);
        return (
            <div className={styles.tlEntry}>
                <span className={styles.tlEntryTime}>{line.time}</span>
                <span className={`${styles.tlEntryIcon} ${iconClass}`}>{icon}</span>
                <span className={styles.tlEntryContent}>{im ? `轮询间隔: ${im[1]}` : line.message}</span>
            </div>
        );
    }

    if (line.type === 'next-check') {
        return (
            <div className={styles.tlEntry}>
                <span className={styles.tlEntryTime}>{line.time}</span>
                <span className={`${styles.tlEntryIcon} ${iconClass}`}>{icon}</span>
                <span className={styles.tlEntryContent}>{line.message.replace(/^下次检查:\s*/, '下次: ')}</span>
            </div>
        );
    }

    return (
        <div className={styles.tlEntry}>
            <span className={styles.tlEntryTime}>{line.time}</span>
            <span className={`${styles.tlEntryIcon} ${iconClass}`}>{icon}</span>
            <span className={styles.tlEntryContent}>{line.message}</span>
        </div>
    );
};

// === 子组件：时间线节点 ===

const TlNode: FC<{ cycle: CheckCycle; isLast: boolean }> = ({ cycle, isLast }) => {
    const shortTime = cycle.startTime.slice(0, 5);

    return (
        <div className={`${styles.tlNode} ${isLast ? styles.tlNodeLast : ''}`}>
            <div className={`${styles.tlDot} ${cycle.foundNew ? styles.tlDotNew : styles.tlDotNone}`} />
            <div className={styles.tlNodeContent}>
                <div className={styles.tlNodeHeader}>
                    <span className={styles.tlNodeTime}>{shortTime}</span>
                    <span className={`${styles.tlBadge} ${cycle.foundNew ? styles.tlBadgeNew : styles.tlBadgeNone}`}>
                        {cycle.foundNew
                            ? (cycle.starCount > 0 ? `新增 ${cycle.starCount} 项` : '发现新内容')
                            : '无新内容'}
                    </span>
                </div>
                <div className={styles.tlEntries}>
                    {cycle.lines.map((line, i) => {
                        if (line.type === 'check-start') return null;
                        return <TlEntry key={i} line={line} />;
                    })}
                </div>
            </div>
        </div>
    );
};

// === 主组件 ===

const LogViewer: FC<LogViewerProps> = ({ url }) => {
    const [logContent, setLogContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLog = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(url, { cache: 'no-cache' });
                if (!response.ok) throw new Error(`Failed: ${response.status}`);
                setLogContent(await response.text());
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };
        fetchLog();
    }, [url]);

    const { cycles, isEmpty } = useMemo(
        () => parseLog(logContent), [logContent]
    );

    // 按日期分组（已按时间倒序）
    const cyclesByDate = useMemo(() => {
        const map: [string, CheckCycle[]][] = [];
        let curDate = '';
        for (const c of cycles) {
            if (c.date !== curDate) {
                curDate = c.date;
                map.push([curDate, [c]]);
            } else {
                map[map.length - 1][1].push(c);
            }
        }
        return map;
    }, [cycles]);

    const summary = useMemo(() => {
        const recentAll = cycles.map(c => ({
            foundNew: c.foundNew,
            tip: `${c.date} ${c.startTime.slice(0, 5)}` +
                (c.foundNew ? (c.starCount > 0 ? ` · 新增${c.starCount}项` : ' · 发现新内容') : ' · 无新内容'),
        }));
        const nextCheckStr = cycles.find(c => c.nextCheck)?.nextCheck;

        let lastCheckDate: Date | null = null;
        let nextCheckDate: Date | null = null;
        let progress = 0;
        let elapsed = '';

        if (cycles[0]) {
            const [y, m, d] = cycles[0].date.split('-').map(Number);
            const [h, min, s] = cycles[0].startTime.split(':').map(Number);
            lastCheckDate = new Date(y, m - 1, d, h, min, s);
            elapsed = formatElapsed(Date.now() - lastCheckDate.getTime());
        }
        if (nextCheckStr) {
            nextCheckDate = parseNextCheckDate(nextCheckStr);
        }
        if (lastCheckDate && nextCheckDate) {
            const total = nextCheckDate.getTime() - lastCheckDate.getTime();
            const passed = Date.now() - lastCheckDate.getTime();
            if (total > 0) progress = Math.min(Math.max(passed / total, 0), 1);
        }

        let remaining = '';
        if (nextCheckDate) {
            const rem = nextCheckDate.getTime() - Date.now();
            remaining = rem > 0 ? formatElapsed(rem) : '已过期';
        }

        return { recentAll, lastCheckDate, nextCheckDate, progress, elapsed, remaining };
    }, [cycles]);

    // 动态计算可显示的圆点数量
    const recentRowRef = useRef<HTMLDivElement>(null);
    const [maxDots, setMaxDots] = useState(8);

    useEffect(() => {
        const el = recentRowRef.current;
        if (!el) return;
        const calc = () => {
            const width = el.clientWidth;
            setMaxDots(Math.max(3, Math.floor((width - 78) / 20)));
        };
        calc();
        const observer = new ResizeObserver(calc);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const visibleDots = summary.recentAll.slice(0, maxDots);

    if (loading) return <div className={styles.loading}>Loading...</div>;
    if (error) return <div className={styles.error}>Load failed: {error}</div>;
    if (isEmpty) return <div className={styles.logContent}><div className={styles.logBody}>{logContent || '日志为空'}</div></div>;

    if (cycles.length === 0) {
        return (
            <div className={styles.logContent}>
                <div className={styles.logBody}>
                    <pre className={styles.rawLog}>{logContent}</pre>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.logContent}>
            <div className={styles.logBody}>
                {/* 摘要栏 */}
                <div className={styles.tlDate}>
                    <span className={styles.tlDateText}>检查进度</span>
                </div>
                <div className={styles.summaryBar}>
                    {summary.lastCheckDate && summary.nextCheckDate && (
                        <div className={styles.progressRow}>
                            <div className={styles.timeBlock}>
                                <div className={styles.timeValue}>{formatShortDate(summary.lastCheckDate)}</div>
                                <div className={styles.timeTitle}>最后检查</div>
                            </div>
                            <div className={styles.arrowOuter}>
                                <div className={styles.arrowContainer}>
                                    <div
                                        className={styles.arrowFill}
                                        style={{ width: `${Math.round(summary.progress * 100)}%` }}
                                    >
                                        <span className={styles.arrowTextElapsed}>已过 {summary.elapsed}</span>
                                    </div>
                                    <div className={styles.arrowRemaining}>
                                        <span className={styles.arrowTextRemaining}>剩余 {summary.remaining}</span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.timeBlock}>
                                <div className={styles.timeValue}>{formatShortDate(summary.nextCheckDate)}</div>
                                <div className={styles.timeTitle}>下次检查</div>
                            </div>
                        </div>
                    )}
                    {visibleDots.length > 0 && (
                        <div className={styles.recentRow} ref={recentRowRef}>
                            <span className={styles.summaryLabel}>最近 {visibleDots.length} 次</span>
                            <span className={styles.summaryDots}>
                                {visibleDots.map((item, i) => (
                                    <span
                                        key={i}
                                        className={item.foundNew ? styles.dotGreen : styles.dotGray}
                                        data-tip={item.tip}
                                    >
                                        {item.foundNew ? '●' : '○'}
                                    </span>
                                ))}
                            </span>
                        </div>
                    )}
                </div>

                {/* 时间轴 */}
                <div className={styles.timeline}>
                    {cyclesByDate.map(([date, dateCycles], di) => (
                        <div key={date}>
                            <div className={styles.tlDate}>
                                <span className={styles.tlDateText}>{date}</span>
                            </div>
                            {dateCycles.map((cycle, ci) => (
                                <TlNode
                                    key={`${date}-${ci}`}
                                    cycle={cycle}
                                    isLast={di === cyclesByDate.length - 1 && ci === dateCycles.length - 1}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LogViewer;
