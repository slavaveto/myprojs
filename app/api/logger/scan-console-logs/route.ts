import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ConsoleResult } from '../types';
import { shouldIgnoreDirectory, shouldIgnoreFileForConsole } from '@/utils/logger/types';

function scanConsoleLogs(dir: string, results: ConsoleResult[] = []): ConsoleResult[] {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (shouldIgnoreDirectory(file)) {
                continue;
            }
            scanConsoleLogs(fullPath, results);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            if (shouldIgnoreFileForConsole(fullPath)) {
                continue;
            }

            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
                const consoleMatch = line.match(/console\.(log|warn|info|debug)\s*\(/);
                if (consoleMatch) {
                    results.push({
                        file: fullPath.replace(process.cwd(), ''),
                        actualLine: index + 1,
                        loggerCall: line.trim(),
                        type: 'console'
                    });
                }
            });
        }
    }
    return results;
}

export async function GET() {
    try {
        const projectRoot = process.cwd();
        const consoleCalls = scanConsoleLogs(projectRoot);
        
        return NextResponse.json({ consoleCalls });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to scan console logs' }, { status: 500 });
    }
}

