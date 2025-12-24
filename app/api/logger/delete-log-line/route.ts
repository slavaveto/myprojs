import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
   try {
      const { file, line } = await request.json();

      if (!file || !line) {
         return NextResponse.json(
            { error: 'Missing required fields: file, line' },
            { status: 400 }
         );
      }

      const projectRoot = process.cwd();
      const filePath = path.join(projectRoot, file);

      // Проверяем существование файла
      if (!fs.existsSync(filePath)) {
         return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      // Читаем файл
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Проверяем что строка существует
      if (line < 1 || line > lines.length) {
         return NextResponse.json({ error: 'Line number out of range' }, { status: 400 });
      }

      // Определяем диапазон строк для удаления (поддержка многострочных вызовов)
      let currentLineIndex = line - 1;
      let openParens = (lines[currentLineIndex].match(/\(/g) || []).length;
      let closeParens = (lines[currentLineIndex].match(/\)/g) || []).length;
      let endLineIndex = currentLineIndex;

      // Если скобки не сбалансированы - ищем конец вызова
      while (openParens > closeParens && endLineIndex < lines.length - 1) {
          endLineIndex++;
          openParens += (lines[endLineIndex].match(/\(/g) || []).length;
          closeParens += (lines[endLineIndex].match(/\)/g) || []).length;
      }

      // Удаляем строки (splice изменяет массив на месте)
      const linesToDelete = endLineIndex - currentLineIndex + 1;
      lines.splice(currentLineIndex, linesToDelete);

      // Записываем обратно
      const newContent = lines.join('\n');
      fs.writeFileSync(filePath, newContent, 'utf-8');

      return NextResponse.json({
         success: true,
         message: `Deleted ${linesToDelete} line(s) starting from ${line} in ${file}`,
      });
   } catch (error) {
      console.error('Error deleting log line:', error);
      return NextResponse.json(
         { error: 'Failed to delete log line' },
         { status: 500 }
      );
   }
}

