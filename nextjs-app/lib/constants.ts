export interface CardConfig {
    id: string;
    icon: string;
    title: string;
    type: 'log' | 'version' | 'weather';
    data: string | null;
    displayTitle: string;
    variant?: 'default' | 'error';
}

// Select log path based on environment
const isDev = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEV_MODE === 'true';
const LOG_BASE_PATH = isDev ? '/api/logs?file=' : '/logs/';

export const sidebarCards: CardConfig[] = [
    {
        id: 'log1',
        icon: '📋',
        title: 'Regular Logs',
        type: 'log',
        data: `${LOG_BASE_PATH}urls.log`,
        displayTitle: 'Regular Logs (urls.log)',
        variant: 'default',
    },
    {
        id: 'log2',
        icon: '⚠️',
        title: 'Error Logs',
        type: 'log',
        data: `${LOG_BASE_PATH}critical_errors.log`,
        displayTitle: 'Error Logs (critical_errors.log)',
        variant: 'error',
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
        title: 'Weather Forecast',
        type: 'weather',
        data: null,
        displayTitle: 'ECMWF Weather Forecast',
    },
];
