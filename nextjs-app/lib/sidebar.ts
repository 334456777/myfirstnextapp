// 静态侧边栏配置
export interface CardConfig {
    id: string;
    icon: string;
    title: string;
    type: string;
    data: any;
    displayTitle: string;
}

export const sidebarCards: CardConfig[] = [
    {
        id: 'log1',
        icon: '📋',
        title: '常规日志',
        type: 'log',
        data: '/logs/urls.log',
        displayTitle: '常规日志 (urls.log)',
    },
    {
        id: 'log2',
        icon: '⚠️',
        title: '错误日志',
        type: 'log',
        data: '/logs/critical_errors.log',
        displayTitle: '错误日志 (critical_errors.log)',
    },
    {
        id: 'version1',
        icon: '📜',
        title: 'SOSRFF',
        type: 'version',
        data: 'shm.jpg',
        displayTitle: '',
    },
    {
        id: 'weather1',
        icon: '🌦️',
        title: '天气预报',
        type: 'weather',
        data: null,
        displayTitle: 'ECMWF天气预报',
    },
];

// 服务端检查日志文件
export async function getVisibleCards(): Promise<string[]> {
    const visible: string[] = [];

    for (const card of sidebarCards) {
        if (card.type === 'log' && card.data) {
            try {
                const response = await fetch(`https://www.yusteven.com${card.data}`, {
                    next: { revalidate: 60 } // ISR: 1分钟重新验证
                });

                if (response.ok) {
                    const text = await response.text();
                    const lines = text.split('\n').filter(line => line.trim());
                    const hasOnlyTitle = lines.length === 1 &&
                        (lines[0].trim() === '#' || lines[0].trim() === '# 记录严重错误');

                    if (!hasOnlyTitle) {
                        visible.push(card.id);
                    }
                }
            } catch (error) {
                console.error(`Error checking log file ${card.data}:`, error);
            }
        } else {
            // 非日志卡片始终显示
            visible.push(card.id);
        }
    }

    return visible;
}
