// lib/data.ts
import 'server-only'; // 🛡️ Protection mechanism: ensure this file never leaks to client
import fs from 'fs/promises';
import path from 'path';
import { sidebarCards } from './constants';

/**
 * Get visible card list
 * - Production: Check if log files have content
 * - Development: Show all cards (using mock data)
 */
export async function getVisibleCards(): Promise<string[]> {
    const visible: string[] = [];

    // Detect if development environment
    const isDev = process.env.NODE_ENV === 'development';
    const hasDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

    // Development: Show all cards
    if (isDev || hasDevMode) {
        console.log('🔧 Development mode: showing all cards');
        return sidebarCards.map(card => card.id);
    }

    // Production: Check if log files have content
    for (const card of sidebarCards) {
        // Non-log cards show directly
        if (card.type !== 'log' || !card.data) {
            visible.push(card.id);
            continue;
        }

        try {
            // Assume card.data stores file path (e.g. /home/yusteven/boluo/pyt/urls.log)
            // If card.data is URL path (/logs/...), you need to map it to absolute path here
            const filePath = card.data.startsWith('/logs/')
                ? `/home/yusteven/boluo/pyt/${card.data.replace('/logs/', '')}`
                : card.data;

            // 1. Get file status (size)
            const stats = await fs.stat(filePath);

            // If file > 1KB, consider has content
            if (stats.size > 1024) {
                visible.push(card.id);
                continue;
            }

            // 2. If file is small, read first 1KB content
            const fileHandle = await fs.open(filePath, 'r');
            try {
                const buffer = Buffer.alloc(Math.min(stats.size, 1024));
                await fileHandle.read(buffer, 0, buffer.length, 0);
                const text = buffer.toString('utf-8');

                const lines = text.split('\n').filter(line => line.trim());

                // Check if only title line (no actual log content)
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
            // File doesn't exist or other error, don't show this card
            console.error(`Check log failed: ${card.data}`, error);
        }
    }

    return visible;
}
