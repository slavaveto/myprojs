import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { LoggerCallInfo, LoggerInfo } from '../types';
import { shouldIgnoreDirectory } from '@/utils/logger/types';

interface ScanResult {
    calls: LoggerCallInfo[];
    definitions: LoggerInfo[];
}

function scanLoggerCalls(dir: string, result: ScanResult = { calls: [], definitions: [] }): ScanResult {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Игнорируем системные папки
            if (shouldIgnoreDirectory(file)) {
                continue;
            }
            scanLoggerCalls(fullPath, result);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            // Обрабатываем все .ts/.tsx файлы (папка utils/logger уже исключена выше)
            
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            
            // Сначала найдем все createLogger в файле
            const componentLoggers = new Map<string, string>(); // variableName -> componentName
            
            lines.forEach((line, index) => {
                // Ищем объявления логгеров: const logger = createLogger('ComponentName')
                const createMatch = line.match(/const\s+(\w+)\s*=\s*createLogger\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
                if (createMatch) {
                    const variableName = createMatch[1];  // logger
                    const componentName = createMatch[2]; // ComponentName
                    componentLoggers.set(variableName, componentName);

                    // Добавляем в definitions (это заменит старый scan-loggers)
                    result.definitions.push({
                        name: componentName,
                        color: 'black',
                        file: fullPath.replace(process.cwd(), ''),
                        line: index + 1
                    });
                }
            });
            
            // Теперь ищем все вызовы логгеров (включая многострочные)
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Ищем начало вызова: logger.method(
                const startMatch = line.match(/(\w+)\.(info|error|success|warning|start|end)\s*\(/);
                if (!startMatch) continue;
                
                const variableName = startMatch[1];
                const method = startMatch[2];
                
                // Проверяем, что это наш логгер
                const componentName = componentLoggers.get(variableName);
                if (!componentName) continue;
                
                // Собираем весь вызов (может быть многострочным)
                let fullCall = line;
                let currentLine = i;
                let openParens = (line.match(/\(/g) || []).length;
                let closeParens = (line.match(/\)/g) || []).length;
                
                // Если скобки не закрыты - читаем следующие строки
                while (openParens > closeParens && currentLine < lines.length - 1) {
                    currentLine++;
                    fullCall += ' ' + lines[currentLine];
                    openParens += (lines[currentLine].match(/\(/g) || []).length;
                    closeParens += (lines[currentLine].match(/\)/g) || []).length;
                }
                
                // Парсим параметры из полного вызова
                // НОВАЯ ЛОГИКА: Ищем: logger.method('message', data?) или logger.method('message', lineNumber, data?)
                // Группы: 2-message
                const paramsMatch = fullCall.match(/\.(info|error|success|warning|start|end)\s*\(\s*['"`]([^'"`]+)['"`]/);
                
                if (paramsMatch) {
                    const message = paramsMatch[2];
                    
                    let dataArg: string | undefined = undefined;
                    
                    // Проверяем есть ли еще аргументы после сообщения
                    // Ищем все внутри скобок после сообщения
                    const argsMatch = fullCall.match(/\.(?:info|error|success|warning|start|end)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*([\s\S]+)\)/);
                    
                    if (argsMatch) {
                        let rawArgs = argsMatch[1].trim();
                        // Удаляем последнюю закрывающую скобку и точку с запятой, если захватили лишнее (для простых случаев)
                        rawArgs = rawArgs.replace(/\)\s*;?$/, '');

                        // Если начинается с цифры и запятой - это старый формат (строка, data)
                        // logger('msg', 123, data)
                        const oldFormatMatch = rawArgs.match(/^(\d+)\s*,\s*([\s\S]+)$/);
                        // logger('msg', 123)
                        const oldFormatDigitOnly = rawArgs.match(/^(\d+)$/);
                        
                        if (oldFormatMatch) {
                            // logger('msg', 123, data) -> берем data
                            dataArg = oldFormatMatch[2];
                        } else if (oldFormatDigitOnly) {
                            // logger('msg', 123) -> data нет (это был номер строки)
                            dataArg = undefined;
                        } else {
                            // logger('msg', data) -> это data
                            // Но если это просто цифра (например logger('msg', 500)) и мы думаем это data?
                            // В старом коде вторым аргументом ВСЕГДА был номер строки.
                            // Если мы сейчас убираем номер строки, то второй аргумент станет data.
                            // Если мы видим цифру сейчас, в немигрированном коде - это номер строки.
                            // В мигрированном коде вторым аргументом может быть что угодно.
                            // ПОКА считаем: если это чисто цифры - это старый номер строки, игнорируем.
                            if (!/^\d+$/.test(rawArgs)) {
                                dataArg = rawArgs;
                            }
                        }
                    }
                    
                    result.calls.push({
                        componentName: componentName,
                        method: method,
                        message: message,
                        file: fullPath.replace(process.cwd(), ''),
                        line: i + 1,  // АВТОМАТИЧЕСКАЯ СТРОКА (где начинается вызов)
                        providedLine: undefined, // Больше не используем providedLine
                        data: dataArg
                    });
                }
            }
        }
    }
    
    return result;
}

export async function GET() {
    try {
        const projectRoot = process.cwd();
        const scanResult = scanLoggerCalls(projectRoot);
        
        return NextResponse.json({ 
            loggerCalls: scanResult.calls,
            loggers: scanResult.definitions 
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to scan logger calls' }, { status: 500 });
    }
}
