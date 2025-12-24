import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ConsoleResult } from '../types';
import { shouldIgnoreFileForConsole } from '@/utils/logger/types';

export async function POST(request: NextRequest) {
   try {
      const { results }: { results: ConsoleResult[] } = await request.json();

      if (!results || !Array.isArray(results)) {
         return NextResponse.json({ error: 'Invalid results data' }, { status: 400 });
      }

      const fixedFiles = new Set<string>();
      let totalFixed = 0;

      // Группируем результаты по файлам (исключая файлы логгера)
      const fileGroups = results.reduce(
         (groups: Record<string, ConsoleResult[]>, result: ConsoleResult) => {
            // Пропускаем файлы логгера и всю папку logger
            if (shouldIgnoreFileForConsole(result.file)) {
               return groups;
            }

            if (!groups[result.file]) {
               groups[result.file] = [];
            }
            groups[result.file].push(result);
            return groups;
         },
         {}
      );

      // Исправляем каждый файл
      for (const [filePath, fileResults] of Object.entries(fileGroups)) {
         const fullPath = path.join(process.cwd(), filePath);

         if (!fs.existsSync(fullPath)) {
            console.warn(`File not found: ${fullPath}`);
            continue;
         }

         const content = fs.readFileSync(fullPath, 'utf-8');
         const lines = content.split('\n');

         // Определяем имя компонента из файла
         const componentName = getComponentName(filePath, content);

         // Проверяем есть ли импорт logger
         const hasLoggerImport = content.includes("from '@/utils/logger/_Logger'");

         // Проверяем есть ли уже createLogger в файле (ПРАВИЛЬНАЯ ПРОВЕРКА)
         const hasLoggerInstance = content.includes(`createLogger('${componentName}')`);

         // СНАЧАЛА заменяем consolee.log (по старым номерам строк)
         const sortedResults = fileResults.sort((a, b) => b.actualLine - a.actualLine);

         for (const result of sortedResults) {
            const lineIndex = result.actualLine - 1;

            if (lineIndex >= 0 && lineIndex < lines.length) {
               const originalLine = lines[lineIndex];
               const fixedLine = replaceConsoleWithLogger(originalLine, result.actualLine);

               if (fixedLine !== originalLine) {
                  lines[lineIndex] = fixedLine;
                  totalFixed++;
               }
            }
         }

         // ПОТОМ добавляем импорт и logger (когда номера строк уже не важны)
         if (!hasLoggerImport) {
            const importIndex = findImportInsertIndex(lines);
            lines.splice(
               importIndex,
               0,
               "import { createLogger } from '@/utils/logger/_Logger';"
            );
         }

         if (!hasLoggerInstance) {
            const loggerIndex = findLoggerInsertIndex(lines);
            lines.splice(loggerIndex, 0, `   const logger = createLogger('${componentName}');`);
         }

         // Записываем исправленный файл
         const fixedContent = lines.join('\n');
         fs.writeFileSync(fullPath, fixedContent, 'utf-8');
         fixedFiles.add(filePath);
      }

      return NextResponse.json({
         success: true,
         message: `Заменено ${totalFixed} consolee.log в ${fixedFiles.size} файлах`,
         fixedFiles: Array.from(fixedFiles),
         totalFixed,
      });
   } catch (error) {
      console.error('Error fixing console logs:', error);
      return NextResponse.json(
         {
            error: 'Failed to fix console logs',
            details: error instanceof Error ? error.message : 'Unknown error',
         },
         { status: 500 }
      );
   }
}

// Определяем имя компонента из файла
function getComponentName(filePath: string, content: string): string {
   // Сначала пробуем найти export default function ComponentName
   const functionMatch = content.match(/export\s+default\s+function\s+(\w+)/);
   if (functionMatch) {
      return functionMatch[1];
   }

   // Если не нашли, берем имя файла
   const fileName = path.basename(filePath, path.extname(filePath));
   return fileName;
}

// Находим место для вставки импорта
function findImportInsertIndex(lines: string[]): number {
   let lastImportIndex = -1;

   for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Ищем строки с импортами
      if (trimmed.startsWith('import ') && trimmed.includes('from')) {
         lastImportIndex = i;
      }
   }

   // Если нашли импорты - вставляем после последнего
   if (lastImportIndex >= 0) {
      return lastImportIndex + 1;
   }

   // Если импортов нет - вставляем в начало после 'use client' или первой строки
   for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("'use client'") || lines[i].includes('"use client"')) {
         return i + 2; // После 'use client' и пустой строки
      }
   }

   return 1; // В самое начало после первой строки
}

// Находим место для вставки logger
function findLoggerInsertIndex(lines: string[]): number {
   let insideInterface = false;
   let braceCount = 0;

   for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Отслеживаем когда мы внутри интерфейса
      if (line.startsWith('interface ')) {
         insideInterface = true;
         braceCount = 0;
      }

      // Считаем скобки чтобы понять когда интерфейс закончился
      if (insideInterface) {
         braceCount += (line.match(/\{/g) || []).length;
         braceCount -= (line.match(/\}/g) || []).length;

         if (braceCount === 0 && line.includes('}')) {
            insideInterface = false;
         }
         continue;
      }

      // Пропускаем импорты, типы, комментарии, пустые строки
      if (
         line.startsWith('import ') ||
         line.startsWith('type ') ||
         line.startsWith('//') ||
         line.startsWith('/*') ||
         line === ''
      ) {
         continue;
      }

      // Ищем export const ComponentName = () => {
      if (line.startsWith('export const ') && line.includes('= (')) {
         // Ищем ТЕЛО функции (после }) => {), не параметры
         let foundArrow = false;
         for (let j = i; j < Math.min(i + 10, lines.length); j++) {
            const currentLine = lines[j];

            if (currentLine.includes('=>') && currentLine.includes('{')) {
               return j + 1;
            }

            if (currentLine.includes('=>')) {
               foundArrow = true;
            } else if (foundArrow && currentLine.includes('{')) {
               return j + 1;
            }
         }
      }

      // Ищем export function ComponentName({ ... }: Props) {
      if (line.startsWith('export function') || line.startsWith('export default function')) {
         // Ищем ТЕЛО функции - после закрытия параметров ): Props) {
         let foundClosingParen = false;
         for (let j = i; j < Math.min(i + 10, lines.length); j++) {
            const currentLine = lines[j];

            // Ищем ): или }) { - это конец параметров и начало тела
            if (currentLine.includes('): ') || currentLine.includes('}) {')) {
               // Ищем { после этого
               for (let k = j; k < Math.min(j + 3, lines.length); k++) {
                  if (lines[k].includes('{')) {
                     return k + 1;
                  }
               }
            }

            // Или просто ищем ) { на одной строке
            if (currentLine.includes(') {')) {
               return j + 1;
            }
         }
      }

      // Ищем обычную function ComponentName() {
      if (line.startsWith('function ') && line.includes('(')) {
         for (let j = i; j < Math.min(i + 3, lines.length); j++) {
            if (lines[j].includes(') {')) {
               return j + 1;
            }
         }
      }
   }

   // Fallback
   return 10;
}

// Заменяем consolee.log на logger
function replaceConsoleWithLogger(line: string, lineNumber: number): string {
   // consolee.log('message', data) → logger.info('message', data)
   line = line.replace(
      /console\.log\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*(.*?)\)/g,
      `logger.info($1, $2)`
   );

   // consolee.log('message') → logger.info('message')
   line = line.replace(
      /console\.log\s*\(\s*(['"`][^'"`]*['"`])\s*\)/g,
      `logger.info($1)`
   );

   line = line.replace(
      /console\.error\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*(.*?)\)/g,
      `logger.error($1, $2)`
   );

   line = line.replace(
      /console\.error\s*\(\s*(['"`][^'"`]*['"`])\s*\)/g,
      `logger.error($1)`
   );

   line = line.replace(
      /console\.warn\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*(.*?)\)/g,
      `logger.warning($1, $2)`
   );

   line = line.replace(
      /console\.warn\s*\(\s*(['"`][^'"`]*['"`])\s*\)/g,
      `logger.warning($1)`
   );

   line = line.replace(
      /console\.info\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*(.*?)\)/g,
      `logger.info($1, $2)`
   );

   line = line.replace(
      /console\.info\s*\(\s*(['"`][^'"`]*['"`])\s*\)/g,
      `logger.info($1)`
   );

   line = line.replace(
      /console\.debug\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*(.*?)\)/g,
      `logger.info($1, $2)`
   );

   line = line.replace(
      /console\.debug\s*\(\s*(['"`][^'"`]*['"`])\s*\)/g,
      `logger.info($1)`
   );

   // consolee.log(variable) - сложный случай, лучше оставить или преобразовать в logger.info('variable', variable)
   // Но пока оставим только строковые литералы первым аргументом, как и было
   
   return line;
}
