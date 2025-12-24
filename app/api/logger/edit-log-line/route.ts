import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
   try {
      const { file, line, newMessage, newMethod } = await request.json();

      if (!file || !line || !newMessage || !newMethod) {
         return NextResponse.json(
            { error: 'Missing required fields: file, line, newMessage, newMethod' },
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

      // Получаем текущую строку
      const currentLine = lines[line - 1];

      // Ищем logger вызов в строке (поддерживаем новый формат без номера строки)
      // logger.method('message') или logger.method('message', data)
      const loggerRegex = /(logger\.)(\w+)\(\s*['"`]([^'"`]+)['"`](.*)\)/;
      const match = currentLine.match(loggerRegex);

      if (!match) {
         return NextResponse.json(
            { error: 'Could not find logger call in line' },
            { status: 400 }
         );
      }

      // Группы: 
      // 1: "logger."
      // 2: method ("info")
      // 3: message ("old message")
      // 4: rest args (", data" or "") - всё что между кавычкой и последней скобкой

      const prefix = match[1];
      const restArgs = match[4];

      const newLine = currentLine.replace(
         loggerRegex,
         `${prefix}${newMethod}('${newMessage}'${restArgs})`
      );

      // Обновляем строку
      lines[line - 1] = newLine;

      // Записываем обратно
      const newContent = lines.join('\n');
      fs.writeFileSync(filePath, newContent, 'utf-8');

      return NextResponse.json({
         success: true,
         message: `Line ${line} updated in ${file}`,
         oldLine: currentLine,
         newLine: newLine,
      });
   } catch (error) {
      console.error('Error editing log line:', error);
      return NextResponse.json(
         { error: 'Failed to edit log line' },
         { status: 500 }
      );
   }
}

