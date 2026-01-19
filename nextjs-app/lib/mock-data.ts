// 本地开发环境的 Mock 数据
import 'server-only';

export interface MockTimeSlot {
    key: string;
    hours: number;
    url: string;
    info: any;
}

export function getMockWeatherData(): MockTimeSlot[] {
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => {
        const hours = (i + 1) * 6;
        const validTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
        return {
            key: `t${hours.toString().padStart(3, '0')}`,
            hours,
            url: 'https://charts.ecmwf.int/opencharts-api/v1/products/medium-mslp-rain/base_time/2025-01-19T00:00:00Z/valid_time/' + validTime.toISOString() + '/style=contour_blacks_lines_thick/style=contour_shaded_foothill/style=basemap_refetters/width=2000/height=1800/file.png',
            info: {
                forecastTime: validTime.toISOString(),
                baseTime: now.toISOString()
            }
        };
    });
}

export function getMockLogContent(type: 'normal' | 'error'): string {
    const now = new Date().toISOString().split('T')[0];

    if (type === 'normal') {
        return `# 系统运行日志
2025-01-19 08:30:15 - INFO - 系统启动成功
2025-01-19 08:35:22 - INFO - 用户登录: user@example.com
2025-01-19 09:15:10 - INFO - 数据同步完成，处理 1,234 条记录
2025-01-19 10:00:05 - INFO - 定时任务执行: 数据备份
2025-01-19 11:20:30 - INFO - API 请求: GET /api/data (200) - 125ms
2025-01-19 12:45:18 - INFO - 缓存已清理
2025-01-19 14:30:00 - INFO - 系统健康检查通过
2025-01-19 15:10:45 - INFO - 用户登出: user@example.com
`;
    } else {
        return `# 记录严重错误
YYYY-MM-DD HH:MM:SS - LEVEL - MESSAGE
2025-01-19 09:25:33 - ERROR - 数据库连接失败: Connection timeout
2025-01-19 10:15:22 - ERROR - API 请求失败: External service unavailable (503)
2025-01-19 11:45:10 - ERROR - 文件写入失败: Permission denied /var/log/app.log
2025-01-19 13:20:55 - ERROR - 内存使用率过高: 85% (警告阈值: 80%)
2025-01-19 14:30:18 - ERROR - 第三方服务响应超时: https://api.example.com
`;
    }
}
