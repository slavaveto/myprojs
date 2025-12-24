import { useAuth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { useMemo } from 'react';

/**
 * Хук для создания клиента Supabase с токеном авторизации от Clerk.
 * Использует механизм перехвата fetch для автоматического добавления токена.
 */
export function useSupabase() {
  const { getToken, userId } = useAuth();

  const supabase = useMemo(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          // Переопределяем fetch, чтобы перед каждым запросом подставлять свежий токен
          fetch: async (url, options = {}) => {
            try {
              // Запрашиваем токен
              const clerkToken = await getToken({ template: 'supabase' });
              
              // ЛОГИ ДЛЯ ОТЛАДКИ
              if (clerkToken) {
              } else {
                // Это нормально для анонимных пользователей
              }

              const headers = new Headers(options?.headers);
              if (clerkToken) {
                headers.set('Authorization', `Bearer ${clerkToken}`);
              }

              return fetch(url, {
                ...options,
                headers,
              });
            } catch (err) {
               throw err;
            }
          },
        },
      }
    );
  }, [getToken]);

  return { supabase, userId };
}
