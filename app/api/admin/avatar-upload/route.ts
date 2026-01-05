import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { DB_TABLES } from '@/utils/supabase/db_tables';

// Инициализация GCS
// GOOGLE_CLOUD_KEY содержит полный JSON сервисного аккаунта
let storage: Storage;

try {
    const keyString = process.env.GOOGLE_CLOUD_KEY;
    if (!keyString) {
        throw new Error('Missing GOOGLE_CLOUD_KEY');
    }
    
    const credentials = JSON.parse(keyString);
    storage = new Storage({
        projectId: credentials.project_id,
        credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
        },
    });
} catch (error) {
}

const bucketName = process.env.GOOGLE_CLOUD_PROJ_BUCKET_NAME || 'daysync';

export async function POST(req: Request) {
    try {
        if (!storage) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
        }

        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only images allowed' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileExtension = file.type.split('/')[1] || 'jpg';
        const fileName = `avatars/${userId}.${fileExtension}`; 
        const bucket = storage.bucket(bucketName);
        const gcsFile = bucket.file(fileName);

        await gcsFile.save(buffer, {
            contentType: file.type,
            resumable: false,
        });

        try {
            await gcsFile.makePublic();
        } catch (e) {
            // Игнорируем ошибку
        }

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}?t=${Date.now()}`;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
             const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
             await supabaseAdmin
                .from(DB_TABLES.PROFILES)
                .update({ 
                    avatar_url: publicUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);
        }

        return NextResponse.json({ success: true, url: publicUrl });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        if (!storage) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
             throw new Error('Missing Supabase configuration');
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

        // Получаем текущую аватарку, чтобы узнать имя файла для удаления
        const { data: profile } = await supabaseAdmin
            .from(DB_TABLES.PROFILES)
            .select('avatar_url')
            .eq('user_id', userId)
            .single();

        if (profile?.avatar_url) {
            try {
                // Извлекаем путь к файлу из URL
                // URL: https://storage.googleapis.com/BUCKET/avatars/ID.EXT
                // Нам нужно: avatars/ID.EXT
                const url = new URL(profile.avatar_url);
                const pathParts = url.pathname.split('/').slice(2); // Пропускаем /BUCKET/
                const filePath = pathParts.join('/');
                
                if (filePath) {
                    const bucket = storage.bucket(bucketName);
                    const file = bucket.file(filePath);
                    await file.delete();
                }
            } catch (e: any) {
                if (e.code !== 404) {
                }
            }
        }
        
        await supabaseAdmin
            .from(DB_TABLES.PROFILES)
            .update({ 
                avatar_url: null,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
