import { useAuth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { useMemo } from 'react';

// --- ANON CLIENT (For Localization / Public Data) ---
export const createAnonClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

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
              const clerkToken = await getToken({ template: 'supabase_daysync_new' });
              
              const headers = new Headers((options as RequestInit)?.headers);
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
