import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * 本地开发环境的日志 API
 * 生产环境使用静态文件服务
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('file');

    if (!filename) {
        return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }

    // 安全检查：防止路径遍历攻击，只允许 .log 文件
    const safeFilename = path.basename(filename);
    if (!safeFilename.endsWith('.log')) {
        return NextResponse.json({ error: 'Only .log files allowed' }, { status: 400 });
    }
    const filePath = path.join(process.cwd(), 'public', 'logs', safeFilename);

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return new NextResponse(content, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Log file not found' }, { status: 404 });
    }
}
