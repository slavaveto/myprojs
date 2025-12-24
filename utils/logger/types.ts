// Типы для системы тегов логгера

// Папки которые игнорируются во всех API (кроме consolee.log проверок)
export const IGNORED_DIRECTORIES = [
    'api',
    'functions', 
    'node_modules',
    '.next',
];

export interface RootTab {
    id: string;
    label: string;
    path: string;
    exclude?: string[];
}

// Hardcoded табы (папки второго уровня)
export const ROOT_TABS: RootTab[] = [
    { id: 'app', label: 'App', path: 'app', exclude: ['app/admin', 'app/api'] },
    { id: 'admin', label: 'Admin', path: 'app/admin' },
    { id: 'utils', label: 'Utils', path: 'utils' },
];

// Проверка нужно ли игнорировать папку (для сканирования логгеров)
export function shouldIgnoreDirectory(dirName: string): boolean {
    return IGNORED_DIRECTORIES.includes(dirName);
}

// Проверка нужно ли игнорировать файл по пути 
export function shouldIgnoreFileForConsole(filePath: string): boolean {
    // Игнорируем только utils/logger/ (НЕ app/admin/logger/!)
    if (filePath.includes('/utils/logger/')) return true;
    
    // Игнорируем utils/storage.ts (использует consolee.error для избежания циклических зависимостей)
    if (filePath.includes('/utils/storage.ts')) return true;
    
    return false;
}

export interface LoggerEvent {
    roomId: string;
    userId: string;
    userName: string;
    component: string;
    page: string;
    method: 'info' | 'start' | 'end' | 'success' | 'error' | 'warning';
    message: string;
    line?: number;
    data?: any;
    timestamp: number;
    logColor?: string;
    componentColor?: string;
 }
