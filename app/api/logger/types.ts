

// Общие интерфейсы
export interface ValidationResult {
    file: string;
    loggerCall: string;
    actualLine: number;
    providedLine: number;
    isCorrect: boolean;
    message: string;
    type: 'logger' | 'console';
}

export interface LoggerInfo {
    name: string;
    color: string;
    file: string;
    line: number;
}

export interface LoggerCallInfo {
    componentName: string;
    method: string;
    message: string;
    file: string;
    line: number;  // actualLine - реальная строка в файле
    providedLine?: number;  // providedLine - номер строки из кода logger('...', 52)
    data?: string;  // data - третий аргумент из кода logger('...', 53, data)
}

export interface ConsoleResult {
    file: string;
    actualLine: number;
    loggerCall: string;
    type: 'console';
}

export interface FixResult {
    file: string;
    actualLine: number;
    providedLine: number;
    loggerCall: string;
    isCorrect: boolean;
}
