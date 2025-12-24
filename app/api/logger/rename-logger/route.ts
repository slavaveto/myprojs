import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
   try {
      const { file, oldName, newName } = await request.json();

      if (!file || !oldName || !newName) {
         return NextResponse.json(
            { error: 'Missing required fields: file, oldName, newName' },
            { status: 400 }
         );
      }

      // Валидация имени (только буквы, цифры, подчеркивания)
      if (!/^[a-zA-Z0-9_]+$/.test(newName)) {
         return NextResponse.json(
            { error: 'Invalid name. Use only letters, numbers, and underscores' },
            { status: 400 }
         );
      }

      // Путь к файлу (относительно workspace root)
      const workspaceRoot = process.cwd();
      const filePath = path.join(workspaceRoot, file.startsWith('/') ? file.slice(1) : file);

      // Проверяем существование файла
      try {
         await fs.access(filePath);
      } catch {
         return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      // Читаем содержимое файла
      let content = await fs.readFile(filePath, 'utf-8');

      // Ищем и заменяем createLogger('OldName') на createLogger('NewName')
      const oldPattern = new RegExp(`createLogger\\(['"\`]${oldName}['"\`]\\)`, 'g');
      const newPattern = `createLogger('${newName}')`;

      // Проверяем, есть ли вообще такой логгер в файле
      if (!oldPattern.test(content)) {
         return NextResponse.json(
            { error: `Logger '${oldName}' not found in file` },
            { status: 404 }
         );
      }

      // Заменяем
      content = content.replace(oldPattern, newPattern);

      // Сохраняем файл
      await fs.writeFile(filePath, content, 'utf-8');

      return NextResponse.json({
         success: true,
         message: `Logger renamed from '${oldName}' to '${newName}'`,
         file,
      });
   } catch (error: any) {
      console.error('Error renaming logger:', error);
      return NextResponse.json(
         { error: 'Failed to rename logger', details: error.message },
         { status: 500 }
      );
   }
}

