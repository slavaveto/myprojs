import { useCallback } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { logService } from '@/app/admin/_services/logService';
import { profileService } from '@/app/admin/_services/profileService';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('ProfileActions');

export function useProfileAction() {
  const { supabase, userId: currentUserId } = useSupabase();

  const { execute: executeUpdate, status: updateStatus } = useAsyncAction({
     useToast: false, 
     successMessage: 'Профиль обновлен',
     errorMessage: 'Ошибка обновления'
  });

  const checkUsernameAvailability = useCallback(async (username: string, currentUserId: string): Promise<boolean> => {
      return profileService.checkUsernameAvailability(supabase, username, currentUserId);
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
        await profileService.updateProfile(supabase, userId, updates);

        // 3. Лог
        if (currentUserId) {
          await logService.logAction(supabase, {
             action: 'PROFILE_UPDATE',
             entity: 'profile',
             entityId: userId,
             details: updates,
             userId: currentUserId
          });
        }
     });
  }, [executeUpdate, supabase, checkUsernameAvailability, currentUserId]);

  return {
    updateProfile,
    checkUsernameAvailability,
    isUpdating: updateStatus === 'loading'
  };
}
