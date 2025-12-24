import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const { file, line } = await request.json();

        if (!file || !line) {
            return NextResponse.json({ error: 'File and line are required' }, { status: 400 });
        }

        const fullPath = path.join(process.cwd(), file);

        if (!fs.existsSync(fullPath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        if (line < 1 || line > lines.length) {
            return NextResponse.json({ error: 'Invalid line number' }, { status: 400 });
        }

        // Удаляем строку (заменяем на пустую или удаляем элемент массива)
        // Лучше удалить элемент, чтобы не оставлять пустых строк?
        // Но тогда номера строк поедут для других логов в этом файле, если мы делаем массовое удаление.
        // Но здесь мы удаляем один.
        // Если удаляем элемент, то номера строк ниже изменятся.
        // После удаления нужно пересканировать.
        
        // Удаляем строку из массива
        lines.splice(line - 1, 1);

        fs.writeFileSync(fullPath, lines.join('\n'));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting console log:', error);
        return NextResponse.json({ error: 'Failed to delete console log' }, { status: 500 });
    }
}

