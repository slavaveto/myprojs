import { useCallback } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { useAudit } from '../../_services/useAudit';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('ProfileActions');
const TABLE_NAME = '_profiles';

export function useProfileAction() {
  const { supabase } = useSupabase();
  const { log } = useAudit();


  const { execute: executeUpdate, status: updateStatus } = useAsyncAction({
     useToast: false, 
     successMessage: 'Профиль обновлен',
     errorMessage: 'Ошибка обновления'
  });

  const checkUsernameAvailability = useCallback(async (username: string, currentUserId: string): Promise<boolean> => {
      if (!username) return true; // Пустой - ок (или не ок? допустим пока валидация на пустоту отдельно)
      
      const { data } = await supabase
         .from(TABLE_NAME)
         .select('user_id')
         .eq('username', username)
         .neq('user_id', currentUserId)
         .maybeSingle();

      return !data; // Если data нет, значит свободно (true)
  }, [supabase]);

  const updateProfile = useCallback(async (userId: string, updates: { username?: string; full_name?: string }) => {
     return executeUpdate(async () => {
        // 1. Проверка уникальности (если меняется username)
        if (updates.username) {
             const isAvailable = await checkUsernameAvailability(updates.username, userId);
             if (!isAvailable) {
                throw new Error('Username занят');
             }
        }

        // 2. Обновление
        const { error } = await supabase
           .from(TABLE_NAME)
           .update({
              ...updates,
              updated_at: new Date().toISOString()
           })
           .eq('user_id', userId);

        if (error) throw error;

        // 3. Лог
        log({ 
           action: 'PROFILE_UPDATE', 
           entity: 'profile', 
           entityId: userId, 
           details: updates 
        });
     });
  }, [executeUpdate, supabase, log, checkUsernameAvailability]);

  return {
    updateProfile,
    checkUsernameAvailability,
    isUpdating: updateStatus === 'loading'
  };
}
