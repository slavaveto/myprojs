import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // No caching

function scanDirectory(dir: string, fileList: string[] = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
                scanDirectory(filePath, fileList);
            }
        } else {
            if (/\.(ts|tsx|js|jsx)$/.test(file)) {
                fileList.push(filePath);
            }
        }
    });

    return fileList;
}

export async function GET() {
    try {
        const rootDir = process.cwd();
        const scanDirs = ['app', 'utils', 'services']; // Основные папки для сканирования
        const allFiles: string[] = [];

        scanDirs.forEach(d => {
            const fullPath = path.join(rootDir, d);
            if (fs.existsSync(fullPath)) {
                scanDirectory(fullPath, allFiles);
            }
        });

        const loggerMap = new Map<string, string[]>(); // Name -> [Files]

        allFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf-8');
            const regex = /createLogger\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
            let match;

            while ((match = regex.exec(content)) !== null) {
                const name = match[1];
                const relativePath = path.relative(rootDir, file);
                
                // Исключаем сам файл определения логгера, если он случайно попал (хотя мы ищем вызовы, а не определение функции)
                // Но лучше исключить файлы в api/logger/scan чтобы не найти самого себя в примере или комменте? 
                // Регулярка ищет вызов. В этом файле регулярка написана как литерал, но она не сматчится сама с собой, т.к. в коде она внутри слешей.
                
                if (!loggerMap.has(name)) {
                    loggerMap.set(name, []);
                }
                loggerMap.get(name)!.push(relativePath);
            }
        });

        const validLoggers: string[] = [];
        const duplicates: { name: string; files: string[] }[] = [];

        loggerMap.forEach((files, name) => {
            validLoggers.push(name);
            if (files.length > 1) {
                duplicates.push({ name, files });
            }
        });

        return NextResponse.json({
            validLoggers,
            duplicates
        });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to scan' }, { status: 500 });
    }
}

