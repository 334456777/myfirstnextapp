// lib/data.ts
import 'server-only'; // 🛡️ 保护机制：确保这个文件绝不会泄露到客户端
import fs from 'fs/promises';
import { sidebarCards } from './constants';

export async function getVisibleCards(): Promise<string[]> {
    const visible: string[] = [];

    for (const card of sidebarCards) {
        // 非日志卡片直接显示
        if (card.type !== 'log' || !card.data) {
            visible.push(card.id);
            continue;
        }

        try {
            // 假设 card.data 存的是文件路径 (例如: /home/yusteven/boluo/pyt/urls.log)
            // 如果 card.data 是 URL 路径 (/logs/...)，你需要在这里做一个映射转换成绝对路径
            const filePath = card.data.startsWith('/logs/')
                ? `/home/yusteven/boluo/pyt/${card.data.replace('/logs/', '')}`
                : card.data;

            // 1. 获取文件状态 (大小)
            const stats = await fs.stat(filePath);

            // 如果文件大于 1KB，直接认为有内容
            if (stats.size > 1024) {
                visible.push(card.id);
                continue;
            }

            // 2. 如果文件很小，读取前 1KB 内容
            const fileHandle = await fs.open(filePath, 'r');
            try {
                const buffer = Buffer.alloc(Math.min(stats.size, 1024));
                await fileHandle.read(buffer, 0, buffer.length, 0);
                const text = buffer.toString('utf-8');

                const lines = text.split('\n').filter(line => line.trim());
                
                // 检查是否只有标题行（无实际日志内容）
                const hasOnlyTitle = lines.length <= 2 && (
                    (lines[0]?.trim() === '#' || lines[0]?.trim() === '# 记录严重错误') &&
                    (!lines[1] || lines[1]?.trim() === 'YYYY-MM-DD HH:MM:SS - LEVEL - MESSAGE')
                );

                if (!hasOnlyTitle) {
                    visible.push(card.id);
                }
            } finally {
                await fileHandle.close();
            }

        } catch (error) {
            // 文件不存在或其他错误，不显示该卡片
            console.error(`Check log failed: ${card.data}`, error);
        }
    }

    return visible;
}
