// lib/data.ts
import 'server-only'; // 🛡️ 保护机制：确保这个文件绝不会泄露到客户端
import fs from 'fs/promises';
import path from 'path';
import { sidebarCards } from './constants';

/**
 * 获取可见的卡片列表
 * - 生产环境：检查日志文件是否有内容
 * - 开发环境：显示所有卡片（使用 mock 数据）
 */
export async function getVisibleCards(): Promise<string[]> {
    const visible: string[] = [];

    // 检测是否为开发环境
    const isDev = process.env.NODE_ENV === 'development';
    const hasDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

    // 开发环境：显示所有卡片
    if (isDev || hasDevMode) {
        console.log('🔧 开发环境模式：显示所有卡片');
        return sidebarCards.map(card => card.id);
    }

    // 生产环境：检查日志文件是否有内容
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
                const hasOnlyTitle = lines.length === 0 || (
                    lines.length <= 2 &&
                    lines[0]?.trim().startsWith('#') &&
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
