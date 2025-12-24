import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Создаем админ-клиента Supabase (с обходом RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // 1. Проверка секретного ключа
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // 2. Получение заголовков
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // Если заголовков нет — ошибка
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    });
  }

  // 3. Получение тела запроса
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // 4. Верификация подписи
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    });
  }

  // 5. Обработка событий
  const eventType = evt.type;
  
  // -- СОЗДАНИЕ ИЛИ ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ --
  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, username, primary_email_address_id } = evt.data;

    // Ищем основной email
    const primaryEmail = email_addresses.find(email => email.id === primary_email_address_id)?.email_address || '';
    
    // Формируем username (если есть) или берем из имени
    // Clerk не всегда дает username, можно генерить или брать имя
    // В твоей логике ты хотел склеить имя
    const fullName = `${first_name || ''} ${last_name || ''}`.trim();

    // Логика генерации username
    let finalUsername = username;
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
            .from('profiles')
            .select('user_id')
            .eq('username', candidateName)
            .maybeSingle();
            
        if (collision && collision.user_id !== id) {
             // Занят другим -> добавляем суффикс к candidateName
             const randomSuffix = Math.random().toString(36).substring(2, 6); // 4 символа
             finalUsername = `${candidateName}${randomSuffix}`;
        } else {
             // Свободен -> берем чистое имя
             finalUsername = candidateName;
        }
    }
    
    // 1. Запись в таблицу USERS (системная)
    // Upsert - если нет, создаст, если есть - обновит
    const { error: userError } = await supabaseAdmin
      .from('users')
      .upsert({
        user_id: id,
        email: primaryEmail,
        // is_super_admin и plan не трогаем при обновлении, если они уже есть, 
        // но при создании можно задать дефолты в самой базе или тут
      }, { onConflict: 'user_id' }); // Важно: обновляем только если совпал ID

    if (userError) {
       console.error('Error upserting user:', userError);
       return new Response('Error db upsert user', { status: 500 });
    }

    // 2. Запись в таблицу PROFILES (публичная)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: id,
        username: finalUsername, // Используем вычисленный username
        full_name: fullName,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (profileError) {
       console.error('Error upserting profile:', profileError);
       return new Response('Error db upsert profile', { status: 500 });
    }
    
    // -- ОТПРАВКА УВЕДОМЛЕНИЯ В TELEGRAM --
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;

    if (tgToken && tgChatId) {
      try {
        const message = `
<b>🔔 Clerk Webhook: ${eventType}</b>
👤 <b>Name:</b> ${fullName || 'N/A'}
📧 <b>Email:</b> ${primaryEmail}
🏷 <b>Username:</b> ${finalUsername}
🆔 <code>${id}</code>
        `.trim();

        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: message,
            parse_mode: 'HTML'
          })
        });
      } catch (tgErr) {
        console.error('Telegram notification failed:', tgErr);
        // Не падаем, если телеграм не сработал
      }
    }
    
    return new Response('User updated/created', { status: 200 });
  }

  // -- УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ --
  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    // Удаляем из базы (каскадное удаление в базе обычно само чистит профиль, но можно явно)
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('user_id', id);

    if (error) {
        console.error('Error deleting user:', error);
        return new Response('Error db delete', { status: 500 });
    }

    return new Response('User deleted', { status: 200 });
  }

  return new Response('', { status: 200 });
}
