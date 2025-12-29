import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // БЕЗОПАСНОСТЬ: По умолчанию всегда DRY RUN (только просмотр).
    // Реальные изменения только если явно передан mode=commit
    const isCommitMode = searchParams.get('mode') === 'commit';
    const isDryRun = !isCommitMode;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables (URL or SERVICE_ROLE_KEY)');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: caller } = await supabaseAdmin
        .from(DB_TABLES.USERS)
        .select('is_super_admin')
        .eq('user_id', userId)
        .single();
        
    if (!caller?.is_super_admin) {
        return NextResponse.json({ error: 'Forbidden: Only Super Admin can sync' }, { status: 403 });
    }

    const client = await clerkClient();
    const clerkUsersResponse = await client.users.getUserList({ limit: 100 });
    const clerkUsers = clerkUsersResponse.data;

    const stats = {
        total: clerkUsers.length,
        created: 0,
        updated: 0,
        toCreate: [] as string[],
        toUpdate: [] as string[],
        toDelete: [] as string[],
        deleted: 0,
    };

    const clerkUserIds = new Set<string>();

    for (const user of clerkUsers) {
        clerkUserIds.add(user.id);
        const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || '';
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // Логика генерации username
        let finalUsername = user.username;
        if (!finalUsername) {
            // 1. Берем часть до собаки и чистим от всего, кроме букв и цифр
            const emailPart = primaryEmail.split('@')[0];
            const cleanName = emailPart.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            
            // Фоллбэк, если после чистки ничего не осталось
            let candidateName = cleanName;
            if (!candidateName || candidateName.length < 2) {
                 const randomSuffix = Math.random().toString(36).substring(2, 8);
                 candidateName = `user${randomSuffix}`;
            }

            // 2. Проверяем, занят ли такой username
            const { data: collision } = await supabaseAdmin
                .from(DB_TABLES.PROFILES)
                .select('user_id')
                .eq('username', candidateName)
                .maybeSingle();
                
            if (collision && collision.user_id !== user.id) {
                 // Занят другим -> добавляем суффикс к candidateName
                 const randomSuffix = Math.random().toString(36).substring(2, 6); // 4 символа
                 finalUsername = `${candidateName}${randomSuffix}`;
            } else {
                 // Свободен -> берем чистое имя
                 finalUsername = candidateName;
            }
        }

        // 1. Проверяем существование пользователя в базе
        const { data: existingUser } = await supabaseAdmin
            .from(DB_TABLES.USERS)
            .select('user_id')
            .eq('user_id', user.id)
            .single();

        if (!existingUser) {
            // Пользователя нет -> CREATE
            if (isDryRun) {
                stats.toCreate.push(`${fullName || finalUsername} (${primaryEmail})`);
            } else {
                // Реальное создание
                await supabaseAdmin.from(DB_TABLES.USERS).insert({
                    user_id: user.id,
                    email: primaryEmail,
                });
                
                await supabaseAdmin.from(DB_TABLES.PROFILES).insert({
                    user_id: user.id,
                    username: finalUsername,
                    full_name: fullName,
                    updated_at: new Date().toISOString(),
                });
                stats.created++;
            }
            continue;
        }

        // 2. Пользователь есть -> UPDATE (проверяем профиль)
        const { data: existingProfile } = await supabaseAdmin
            .from(DB_TABLES.PROFILES)
            .select('user_id, full_name')
            .eq('user_id', user.id)
            .single();

        let needsUpdate = false;
        const updates: any = { updated_at: new Date().toISOString() };

        // Если профиля нет или пустой full_name
        if (!existingProfile || !existingProfile.full_name) {
             if (fullName) {
                 updates.full_name = fullName;
                 needsUpdate = true;
             }
        }
        
        // В реальном update мы бы еще email обновили в users, если надо, но это скрыто
        // Допустим, мы считаем апдейтом только изменения в профиле для наглядности

        if (needsUpdate) {
            if (isDryRun) {
                stats.toUpdate.push(`${fullName || finalUsername} (${primaryEmail})`);
            } else {
                if (existingProfile) {
                    await supabaseAdmin.from(DB_TABLES.PROFILES).update(updates).eq('user_id', user.id);
                } else {
                    // Если профиля не было совсем, создаем
                    await supabaseAdmin.from(DB_TABLES.PROFILES).insert({
                        user_id: user.id,
                        username: finalUsername,
                        full_name: fullName,
                        updated_at: new Date().toISOString(),
                    });
                }
                stats.updated++;
            }
        }
    }

    // --- DELETION LOGIC ---
    // Находим юзеров в Supabase, которых нет в Clerk
    // Важно: не удаляем текущего админа (себя)
    const { data: allSupabaseUsers } = await supabaseAdmin
        .from(DB_TABLES.USERS)
        .select('user_id, email, is_super_admin');

    if (allSupabaseUsers) {
        for (const dbUser of allSupabaseUsers) {
            // Если юзера нет в Clerk И это не текущий админ (на всякий случай)
            if (!clerkUserIds.has(dbUser.user_id) && dbUser.user_id !== userId) {
                if (isDryRun) {
                    stats.toDelete.push(`${dbUser.email || dbUser.user_id}`);
                } else {
                    // Удаляем профиль явно (на случай отсутствия каскада)
                    await supabaseAdmin.from(DB_TABLES.PROFILES).delete().eq('user_id', dbUser.user_id);
                    // Удаляем юзера
                    await supabaseAdmin.from(DB_TABLES.USERS).delete().eq('user_id', dbUser.user_id);
                    stats.deleted++;
                }
            }
        }
    }

    return NextResponse.json({ 
        success: true, 
        stats
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
